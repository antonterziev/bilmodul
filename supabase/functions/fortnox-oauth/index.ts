
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log('Fortnox OAuth request:', { method: req.method, url: url.toString() });

  // Handle GET request (OAuth callback from Fortnox) - This is now handled by the React app
  if (req.method === 'GET') {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Callback</title></head>
        <body>
          <h1>OAuth Callback</h1>
          <p>This endpoint is now handled by the React app at /fortnox-callback</p>
          <p>Please use the correct redirect URI: https://lagermodulen.se/fortnox-callback</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }

  // Handle POST requests (API calls from frontend)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { action, code, state, user_id } = payload;
  const clientId = Deno.env.get('FORTNOX_CLIENT_ID');
  const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
  const redirectUri = 'https://lagermodulen.se/fortnox-callback'; // Updated to use custom domain

  if (!clientId || !clientSecret) {
    console.error('Missing Fortnox credentials');
    return new Response(JSON.stringify({ error: 'Missing server credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Debug: Log credentials (without exposing sensitive data)
  console.log('Fortnox credentials check:', {
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
    clientSecret: clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING',
    redirectUri
  });

  if (action === 'get_auth_url') {
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const state = crypto.randomUUID();
    
    // Store state for CSRF protection with user association
    const { error: stateError } = await supabase
      .from('fortnox_integrations')
      .upsert({
        user_id,
        access_token: state, // Temporarily store state in access_token field
        is_active: false // Mark as inactive until OAuth completes
      });

    if (stateError) {
      console.error('Error storing state:', stateError);
      return new Response(JSON.stringify({ error: 'Failed to initialize OAuth' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const scope = 'companyinformation'; // Using the scope you have enabled
    // Clean URL for production environment
    const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `account_type=service`;

    console.log('Generated Fortnox auth URL for user:', user_id);
    console.log('Using redirect URI:', redirectUri);

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (action === 'handle_callback') {
    console.log('Processing callback with parameters:', {
      code: code ? `${code.substring(0, 8)}...` : 'MISSING',
      state: state ? `${state.substring(0, 8)}...` : 'MISSING',
      user_id
    });

    // Verify state to prevent CSRF attacks
    const { data: validState, error: stateError } = await supabase
      .from('fortnox_integrations')
      .select('user_id')
      .eq('access_token', state)
      .eq('is_active', false)
      .single();

    if (stateError) {
      console.error('State validation error:', stateError);
      return new Response(JSON.stringify({ error: 'State validation failed', details: stateError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!validState) {
      console.error('Invalid or expired state token:', state);
      return new Response(JSON.stringify({ error: 'Invalid or expired state token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prepare token exchange request
    const tokenPayload = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    };

    console.log('Token exchange request payload:', {
      grant_type: tokenPayload.grant_type,
      code: tokenPayload.code ? `${tokenPayload.code.substring(0, 8)}...` : 'MISSING',
      redirect_uri: tokenPayload.redirect_uri,
      client_id: tokenPayload.client_id ? `${tokenPayload.client_id.substring(0, 8)}...` : 'MISSING',
      client_secret: tokenPayload.client_secret ? 'PROVIDED' : 'MISSING'
    });

    try {
      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenPayload)
      });

      const tokenData = await tokenResponse.json();

      console.log('Fortnox token response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        error: tokenData.error,
        errorDescription: tokenData.error_description
      });

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return new Response(JSON.stringify({ 
          error: 'Token exchange failed', 
          details: tokenData,
          fortnox_error: tokenData.error,
          fortnox_error_description: tokenData.error_description
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store the tokens in the existing fortnox_integrations table
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      const { error: updateError } = await supabase
        .from('fortnox_integrations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', validState.user_id)
        .eq('is_active', false);

      if (updateError) {
        console.error('Error storing tokens:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to store integration tokens' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Fortnox integration successful for user:', validState.user_id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (fetchError) {
      console.error('Network error during token exchange:', fetchError);
      return new Response(JSON.stringify({ 
        error: 'Network error during token exchange', 
        details: fetchError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
