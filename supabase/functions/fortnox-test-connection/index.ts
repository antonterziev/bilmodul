import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    console.log('Testing Fortnox connection for user:', user.id)

    // Get the user's Fortnox integration
    const { data: fortnoxIntegrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (integrationError) {
      console.error('Error fetching Fortnox integration:', integrationError)
      throw new Error('Error fetching Fortnox integration')
    }

    if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No active Fortnox integration found. Please connect to Fortnox first.',
          integrations_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fortnoxIntegration = fortnoxIntegrations[0]

    console.log('Found Fortnox integration:', {
      id: fortnoxIntegration.id,
      expires_at: fortnoxIntegration.token_expires_at,
      has_refresh_token: !!fortnoxIntegration.refresh_token
    })

    // Check token expiration
    const tokenExpiresAt = new Date(fortnoxIntegration.token_expires_at)
    const now = new Date()
    const isTokenExpired = tokenExpiresAt <= now

    // Test a simple Fortnox API call (get company info)
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    if (!clientSecret) {
      throw new Error('Missing FORTNOX_CLIENT_SECRET');
    }

    try {
      console.log(`🔑 Using access token: ${fortnoxIntegration.access_token.substring(0, 20)}...`);
      console.log(`🔑 Using client secret: ${clientSecret.substring(0, 10)}...`);
      
      const testResponse = await fetch('https://api.fortnox.se/3/companyinformation', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
          'Client-Secret': clientSecret,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      const responseText = await testResponse.text()
      console.log('Fortnox test API response:', {
        status: testResponse.status,
        ok: testResponse.ok,
        body: responseText.substring(0, 200)
      })

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Fortnox connection test successful',
          integration_id: fortnoxIntegration.id,
          token_expired: isTokenExpired,
          token_expires_at: tokenExpiresAt.toISOString(),
          api_response_status: testResponse.status,
          api_response_ok: testResponse.ok
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (apiError) {
      console.error('Fortnox API test failed:', apiError)
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `Fortnox API test failed: ${(apiError as Error).message || 'Unknown API error'}`,
          integration_id: fortnoxIntegration.id,
          token_expired: isTokenExpired
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in fortnox-test-connection:', error)
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Unknown error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})