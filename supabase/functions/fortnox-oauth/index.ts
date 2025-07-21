
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, state } = await req.json();
    
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Missing Fortnox credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Fortnox credentials' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'get_auth_url') {
      // Generate authorization URL
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`;
      const scope = 'companyinformation customer supplier article companyaccount bookkeeping';
      const state = crypto.randomUUID();
      
      const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `response_type=code&` +
        `access_type=offline`;

      console.log('Generated Fortnox auth URL:', authUrl);
      
      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'handle_callback') {
      // This would be called when Fortnox redirects back
      // Exchange authorization code for access token
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`;
      
      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return new Response(
          JSON.stringify({ error: 'Token exchange failed' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Token exchange successful');
      
      // Here you would typically store the tokens in your database
      // For now, we'll just return success
      return new Response(
        JSON.stringify({ success: true, tokens: tokenData }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Fortnox OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
