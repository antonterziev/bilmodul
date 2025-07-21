
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to create detailed error responses
const createErrorResponse = (message: string, details?: any) => {
  console.error('Creating error response:', { message, details });
  const encodedMessage = encodeURIComponent(message);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://lagermodulen.se/fortnox-callback?status=error&message=${encodedMessage}`
    }
  });
};

// Helper function to add delay for timing issues
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate authorization code timing
const validateCodeTiming = (codeCreatedAt: string, maxAgeMs: number = 60000) => {
  const codeAge = Date.now() - new Date(codeCreatedAt).getTime();
  return codeAge <= maxAgeMs;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log('Fortnox OAuth request:', { 
    method: req.method, 
    url: url.toString(),
    timestamp: new Date().toISOString()
  });

  const clientId = Deno.env.get('FORTNOX_CLIENT_ID');
  const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
  const redirectUri = 'https://yztwwehxppldoecwhomg.supabase.co/functions/v1/fortnox-oauth';

  if (!clientId || !clientSecret) {
    console.error('Missing Fortnox credentials');
    if (req.method === 'GET') {
      return createErrorResponse('Server configuration error. Kontakta support.');
    }
    return new Response(JSON.stringify({ error: 'Missing server credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle GET request (OAuth callback from Fortnox)
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    const requestId = crypto.randomUUID();
    console.log(`🔁 OAuth callback received ${requestId}:`, {
      code: code ? `${code.substring(0, 8)}...` : 'MISSING',
      state: state ? `${state.substring(0, 8)}...` : 'MISSING',
      error,
      errorDescription,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')
    });

    // Handle error from Fortnox
    if (error) {
      console.error(`Fortnox OAuth error for ${requestId}:`, { error, errorDescription });
      const errorMessage = `Fortnox-fel: ${errorDescription || error}`;
      return createErrorResponse(errorMessage);
    }

    if (!code || !state) {
      console.error(`Missing parameters for ${requestId}:`, { hasCode: !!code, hasState: !!state });
      return createErrorResponse('Saknar auktoriseringskod från Fortnox. Försök igen.');
    }

    try {
      // Add deliberate delay to prevent timing issues (1.5 seconds)
      console.log(`⏱️ Adding 1.5s delay before processing ${requestId} to prevent timing issues`);
      await delay(1500);

      // Cleanup old states first
      await supabase.rpc('cleanup_old_oauth_states');

      // CRITICAL: Check if this authorization code has already been used
      const { data: existingCode } = await supabase
        .from('fortnox_integrations')
        .select('id, oauth_code, code_used_at, created_at')
        .eq('oauth_code', code)
        .not('code_used_at', 'is', null)
        .maybeSingle();

      if (existingCode) {
        console.error(`🚫 Code reuse detected for ${requestId}:`, {
          previousUse: existingCode.code_used_at,
          integrationId: existingCode.id,
          timeSinceFirstUse: Date.now() - new Date(existingCode.code_used_at).getTime()
        });
        return createErrorResponse('Denna kod har redan använts. Starta om anslutningsprocessen från början.');
      }

      // Verify state using dedicated OAuth states table
      const { data: validState, error: stateError } = await supabase
        .from('fortnox_oauth_states')
        .select('user_id, created_at, used_at')
        .eq('state', state)
        .maybeSingle();

      if (stateError) {
        console.error(`State lookup failed for ${requestId}:`, stateError);
        return createErrorResponse('Databas-fel vid validering. Försök igen.');
      }

      if (!validState) {
        console.error(`Invalid state for ${requestId}: state not found in database`);
        return createErrorResponse('Ogiltig session. Starta om anslutningsprocessen.');
      }

      if (validState.used_at) {
        console.error(`State reuse attempt for ${requestId}: already used at ${validState.used_at}`);
        return createErrorResponse('Session redan använd. Starta om anslutningsprocessen.');
      }

      // Check if state is too old (more than 10 minutes)
      const stateAge = Date.now() - new Date(validState.created_at).getTime();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (stateAge > maxAge) {
        console.error(`State expired for ${requestId}. Age: ${Math.round(stateAge / 60000)} minutes`);
        return createErrorResponse('Session har gått ut. Starta om anslutningsprocessen.');
      }

      console.log(`✅ State validated for user ${validState.user_id} in ${requestId}. State age: ${Math.round(stateAge / 1000)}s`);

      // Mark the state as used immediately to prevent race conditions
      const { error: markStateUsedError } = await supabase
        .from('fortnox_oauth_states')
        .update({ used_at: new Date().toISOString() })
        .eq('state', state);

      if (markStateUsedError) {
        console.error(`Failed to mark state as used for ${requestId}:`, markStateUsedError);
      } else {
        console.log(`✅ State marked as used for ${requestId}`);
      }

      // Prepare token exchange request with detailed logging
      const tokenPayload = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      };

      console.log(`🔄 Token exchange request for ${requestId}:`, {
        grant_type: tokenPayload.grant_type,
        code: `${code.substring(0, 8)}...`,
        redirect_uri: tokenPayload.redirect_uri,
        client_id: `${clientId.substring(0, 8)}...`,
        client_secret: 'PROVIDED',
        timestamp: new Date().toISOString(),
        codeLength: code.length
      });

      // Add another small delay before token exchange
      console.log(`⏱️ Adding 500ms delay before token exchange for ${requestId}`);
      await delay(500);

      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Veksla-OAuth-Client/1.0'
        },
        body: new URLSearchParams(tokenPayload)
      });

      const tokenData = await tokenResponse.json();

      console.log(`📥 Fortnox token response for ${requestId}:`, {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        error: tokenData.error,
        errorDescription: tokenData.error_description,
        responseHeaders: Object.fromEntries(tokenResponse.headers.entries()),
        timestamp: new Date().toISOString()
      });

      if (!tokenResponse.ok) {
        console.error(`❌ Token exchange failed for ${requestId}:`, {
          status: tokenResponse.status,
          error: tokenData.error,
          description: tokenData.error_description,
          fullResponse: tokenData
        });
        
        // Provide specific error messages based on Fortnox error codes
        let userFriendlyMessage = 'Kunde inte ansluta till Fortnox.';
        
        if (tokenData.error === 'invalid_grant') {
          if (tokenData.error_description?.includes("doesn't exist")) {
            userFriendlyMessage = 'Auktoriseringskoden är ogiltig. Detta kan bero på att du väntat för länge eller att koden redan använts. Försök igen från början.';
          } else if (tokenData.error_description?.includes("invalid for the client")) {
            userFriendlyMessage = 'Felaktig klient-konfiguration. Kontrollera att Fortnox-appen har rätt redirect URI: ' + redirectUri;
          } else {
            userFriendlyMessage = 'Auktoriseringskoden kunde inte användas. Försök igen - klicka bara en gång på "Anslut" och vänta tills processen är klar.';
          }
        } else if (tokenData.error === 'invalid_client') {
          userFriendlyMessage = 'Fel klient-uppgifter. Kontakta support.';
        } else if (tokenData.error === 'invalid_request') {
          userFriendlyMessage = 'Felaktig förfrågan till Fortnox. Försök igen.';
        }
        
        return createErrorResponse(userFriendlyMessage);
      }

      // Store tokens in fortnox_integrations table (upsert for user)
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      const { error: upsertError } = await supabase
        .from('fortnox_integrations')
        .upsert({
          user_id: validState.user_id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          oauth_code: code,
          code_used_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        console.error(`❌ Error storing tokens for ${requestId}:`, upsertError);
        return createErrorResponse('Kunde inte spara anslutningsuppgifter. Försök igen.');
      }

      // Clean up the used state after successful token exchange
      await supabase
        .from('fortnox_oauth_states')
        .delete()
        .eq('state', state);

      console.log(`🎉 Fortnox integration successful for user ${validState.user_id}, request ${requestId}`);

      // Redirect to success page
      const successMessage = encodeURIComponent('Fortnox-anslutning lyckad!');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://lagermodulen.se/fortnox-callback?status=success&message=${successMessage}`
        }
      });

    } catch (fetchError) {
      console.error(`💥 Network/processing error for ${requestId}:`, {
        error: fetchError.message,
        stack: fetchError.stack,
        timestamp: new Date().toISOString()
      });
      return createErrorResponse('Nätverksfel eller serverfel. Kontrollera internetanslutningen och försök igen.');
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

  const { action, user_id } = payload;

  // ENV CHECK: Log environment and credentials for debugging
  console.log(`🔧 ENV CHECK for action ${action}:`, {
    environment: 'production',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
    clientSecret: clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING',
    redirectUri,
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    timestamp: new Date().toISOString()
  });

  if (action === 'get_auth_url') {
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Cleanup old states first
      await supabase.rpc('cleanup_old_oauth_states');

      const state = crypto.randomUUID();
      
      // Store state in dedicated OAuth states table for CSRF protection
      const { error: stateError } = await supabase
        .from('fortnox_oauth_states')
        .insert({
          state,
          user_id
        });

      if (stateError) {
        console.error('❌ Error storing OAuth state:', stateError);
        return new Response(JSON.stringify({ error: 'Failed to initialize OAuth' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const scope = 'companyinformation';
      // USING PRODUCTION ENDPOINT FOR AUTH URL
      const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `response_type=code&` +
        `access_type=offline`;

      console.log(`🔗 Generated Fortnox auth URL for user ${user_id}:`, {
        state: `${state.substring(0, 8)}...`,
        redirectUri,
        scope,
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('❌ Error generating auth URL:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate auth URL' }), {
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
