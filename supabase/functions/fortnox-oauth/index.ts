
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
  const redirectUri = 'https://lagermodulen.se/fortnox-callback';

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
    const timestamp = new Date().toISOString();
    
    // Store state with timestamp for CSRF protection and tracking
    const { error: stateError } = await supabase
      .from('fortnox_integrations')
      .upsert({
        user_id,
        access_token: state, // Temporarily store state in access_token field
        is_active: false, // Mark as inactive until OAuth completes
        created_at: timestamp,
        updated_at: timestamp
      });

    if (stateError) {
      console.error('Error storing state:', stateError);
      return new Response(JSON.stringify({ error: 'Failed to initialize OAuth' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const scope = 'companyinformation';
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
    console.log('State generated:', state);

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (action === 'handle_callback') {
    const requestId = crypto.randomUUID();
    console.log(`Processing callback ${requestId} with parameters:`, {
      code: code ? `${code.substring(0, 8)}...` : 'MISSING',
      state: state ? `${state.substring(0, 8)}...` : 'MISSING',
      user_id
    });

    // Verify state to prevent CSRF attacks and code reuse
    const { data: validState, error: stateError } = await supabase
      .from('fortnox_integrations')
      .select('user_id, created_at')
      .eq('access_token', state)
      .eq('is_active', false)
      .single();

    if (stateError || !validState) {
      console.error(`State validation failed for request ${requestId}:`, stateError);
      return new Response(JSON.stringify({ 
        error: 'Ogiltig eller utgången auktoriserings-session. Försök ansluta igen från början.',
        technical_details: { error: 'Invalid or expired state token' }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if state is too old (more than 10 minutes)
    const stateAge = Date.now() - new Date(validState.created_at).getTime();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (stateAge > maxAge) {
      console.error(`State expired for request ${requestId}. Age: ${stateAge}ms, Max: ${maxAge}ms`);
      return new Response(JSON.stringify({ 
        error: 'Auktoriserings-sessionen har gått ut. Försök ansluta igen från början.',
        technical_details: { error: 'State token expired' }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Invalidate the state immediately to prevent reuse
    const { error: invalidateError } = await supabase
      .from('fortnox_integrations')
      .update({ access_token: `used_${requestId}`, updated_at: new Date().toISOString() })
      .eq('access_token', state);

    if (invalidateError) {
      console.error(`Failed to invalidate state for request ${requestId}:`, invalidateError);
    }

    // Prepare token exchange request
    const tokenPayload = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    };

    console.log(`Token exchange request payload for ${requestId}:`, {
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

      console.log(`Fortnox token response for ${requestId}:`, {
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
        console.error(`Token exchange failed for ${requestId}:`, tokenData);
        
        // Provide specific error messages based on Fortnox error codes
        let userFriendlyMessage = 'Kunde inte ansluta till Fortnox.';
        
        if (tokenData.error === 'invalid_grant') {
          userFriendlyMessage = 'Auktoriseringskoden är ogiltig eller har redan använts. Kontrollera att redirect URI i Fortnox-appen är korrekt inställd till: https://lagermodulen.se/fortnox-callback';
        } else if (tokenData.error === 'invalid_client') {
          userFriendlyMessage = 'Felaktig klient-konfiguration. Kontrollera att Client ID och Client Secret är korrekta i Fortnox-appen.';
        } else if (tokenData.error === 'invalid_request') {
          userFriendlyMessage = 'Felaktig förfrågan till Fortnox. Försök igen.';
        }
        
        return new Response(JSON.stringify({ 
          error: userFriendlyMessage,
          technical_details: {
            fortnox_error: tokenData.error,
            fortnox_error_description: tokenData.error_description,
            request_id: requestId
          }
        }), {
          status: 200,
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
        .eq('access_token', `used_${requestId}`);

      if (updateError) {
        console.error(`Error storing tokens for ${requestId}:`, updateError);
        return new Response(JSON.stringify({ 
          error: 'Kunde inte spara anslutningsuppgifter. Försök igen.',
          technical_details: { error: 'Failed to store integration tokens' }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Fortnox integration successful for user ${validState.user_id}, request ${requestId}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (fetchError) {
      console.error(`Network error during token exchange for ${requestId}:`, fetchError);
      return new Response(JSON.stringify({ 
        error: 'Nätverksfel vid anslutning till Fortnox. Kontrollera din internetanslutning och försök igen.',
        technical_details: { 
          error: 'Network error during token exchange',
          details: fetchError.message,
          request_id: requestId
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
