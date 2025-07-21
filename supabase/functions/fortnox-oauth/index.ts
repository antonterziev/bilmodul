
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

  // Handle GET request (OAuth callback from Fortnox)
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    // Log all parameters for debugging
    const allParams = Object.fromEntries(url.searchParams.entries());
    console.log('OAuth callback received with params:', allParams);
    
    // Handle error from Fortnox
    if (error) {
      console.error('Fortnox OAuth error:', { error, errorDescription });
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>Fortnox Authorization Error</title></head>
          <body>
            <h1>Authorization Error</h1>
            <p><strong>Error:</strong> ${error}</p>
            ${errorDescription ? `<p><strong>Description:</strong> ${errorDescription}</p>` : ''}
            <p>Please try the integration again.</p>
            <script>setTimeout(() => window.location.href = '/', 5000);</script>
          </body>
        </html>
      `, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    if (!code || !state) {
      console.error('Missing code or state in OAuth callback');
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>OAuth Error</title></head>
          <body>
            <h1>OAuth Error</h1>
            <p>Missing authorization code or state parameter.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Handle the OAuth callback (same logic as handle_callback action)
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`;

    if (!clientId || !clientSecret) {
      console.error('Missing Fortnox credentials');
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>Configuration Error</title></head>
          <body>
            <h1>Configuration Error</h1>
            <p>Server configuration error. Please contact support.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Verify state and get user_id
    const { data: validState } = await supabase
      .from('fortnox_integrations')
      .select('user_id')
      .eq('access_token', state)
      .eq('is_active', false)
      .single();

    if (!validState) {
      console.error('Invalid or expired state token:', state);
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>OAuth Error</title></head>
          <body>
            <h1>OAuth Error</h1>
            <p>Invalid or expired authorization state. Please try again.</p>
            <script>setTimeout(() => window.location.href = '/', 3000);</script>
          </body>
        </html>
      `, {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Exchange code for tokens
    try {
      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>OAuth Error</title></head>
            <body>
              <h1>OAuth Error</h1>
              <p>Failed to complete authorization. Please try again.</p>
              <script>setTimeout(() => window.location.href = '/', 3000);</script>
            </body>
          </html>
        `, {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      // Store tokens
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
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>OAuth Error</title></head>
            <body>
              <h1>OAuth Error</h1>
              <p>Failed to save authorization. Please try again.</p>
              <script>setTimeout(() => window.location.href = '/', 3000);</script>
            </body>
          </html>
        `, {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      console.log('Fortnox integration successful for user:', validState.user_id);

      // Success page with redirect
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>Integration Successful</title></head>
          <body>
            <h1>Fortnox Integration Successful!</h1>
            <p>Your Fortnox account has been successfully connected.</p>
            <p>Redirecting to dashboard...</p>
            <script>
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
            </script>
          </body>
        </html>
      `, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });

    } catch (error) {
      console.error('OAuth callback error:', error);
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>OAuth Error</title></head>
          <body>
            <h1>OAuth Error</h1>
            <p>An unexpected error occurred. Please try again.</p>
            <script>setTimeout(() => window.location.href = '/', 3000);</script>
          </body>
        </html>
      `, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }
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
  const redirectUri = `${supabaseUrl}/functions/v1/fortnox-oauth`;

  if (!clientId || !clientSecret || !supabaseUrl) {
    console.error('Missing Fortnox credentials');
    return new Response(JSON.stringify({ error: 'Missing server credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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

    const scope = 'companyinformation'; // Minimal scope for test environment
    // Clean URL for test environment
    const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}&` +
      `response_type=code&` +
      `access_type=offline`;

    console.log('Generated Fortnox auth URL for user:', user_id);

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (action === 'handle_callback') {
    // Verify state to prevent CSRF attacks
    const { data: validState } = await supabase
      .from('fortnox_integrations')
      .select('user_id')
      .eq('access_token', state)
      .eq('is_active', false)
      .single();

    if (!validState) {
      console.error('Invalid or expired state token:', state);
      return new Response(JSON.stringify({ error: 'Invalid or expired state token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
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
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
