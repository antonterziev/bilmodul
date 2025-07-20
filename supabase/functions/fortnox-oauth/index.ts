
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('Fortnox OAuth function called:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created successfully');

    const { action, code, state } = await req.json()
    console.log('Request data:', { action, code: code ? 'present' : 'missing', state: state ? 'present' : 'missing' });
    
    // Get user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Invalid user token:', userError);
      throw new Error('Invalid user token')
    }

    console.log('User authenticated:', user.id);

    if (action === 'get_auth_url') {
      console.log('Getting auth URL...');
      
      // Check if required environment variables are set
      const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
      const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
      
      console.log('Environment check:', {
        clientId: clientId ? 'present' : 'MISSING',
        clientSecret: clientSecret ? 'present' : 'MISSING'
      });
      
      if (!clientId) {
        console.error('FORTNOX_CLIENT_ID is not set');
        throw new Error('Fortnox client ID is not configured')
      }
      
      if (!clientSecret) {
        console.error('FORTNOX_CLIENT_SECRET is not set');
        throw new Error('Fortnox client secret is not configured')
      }
      
      // Generate OAuth URL for Fortnox
      const redirectUri = `${req.headers.get('origin')}/dashboard`
      const stateParam = crypto.randomUUID()
      
      console.log('OAuth parameters:', {
        clientId,
        redirectUri,
        stateParam
      });
      
      const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=article customer invoice&` +
        `state=${stateParam}&` +
        `response_type=code&` +
        `access_type=offline`

      console.log('Generated auth URL:', authUrl);

      // Store state for verification
      const { error: upsertError } = await supabase
        .from('fortnox_integrations')
        .upsert({
          user_id: user.id,
          access_token: stateParam, // Temporarily store state here
          is_active: false
        })

      if (upsertError) {
        console.error('Database upsert error:', upsertError);
        throw new Error('Failed to store OAuth state')
      }

      console.log('OAuth state stored successfully');

      return new Response(
        JSON.stringify({ auth_url: authUrl, state: stateParam }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'exchange_code') {
      console.log('Exchanging code for token...');
      
      // Exchange authorization code for access token
      const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
      const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
      const redirectUri = `${req.headers.get('origin')}/dashboard`

      console.log('Token exchange parameters:', {
        clientId: clientId ? 'present' : 'missing',
        clientSecret: clientSecret ? 'present' : 'missing',
        redirectUri,
        code: code ? 'present' : 'missing'
      });

      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      })

      console.log('Token response status:', tokenResponse.status);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Fortnox token exchange failed:', errorText)
        throw new Error('Failed to exchange code for token')
      }

      const tokenData = await tokenResponse.json()
      console.log('Token data received:', { 
        access_token: tokenData.access_token ? 'present' : 'missing',
        refresh_token: tokenData.refresh_token ? 'present' : 'missing',
        expires_in: tokenData.expires_in 
      });
      
      // Get company info from Fortnox
      console.log('Getting company info...');
      const companyResponse = await fetch('https://api.fortnox.se/3/companyinformation/', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Client-Secret': clientSecret
        }
      })

      let companyName = null
      if (companyResponse.ok) {
        const companyData = await companyResponse.json()
        companyName = companyData.CompanyInformation?.CompanyName
        console.log('Company name retrieved:', companyName);
      } else {
        console.warn('Failed to get company info:', companyResponse.status);
      }

      // Store tokens in database
      console.log('Storing tokens in database...');
      const { error: updateError } = await supabase
        .from('fortnox_integrations')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          company_name: companyName,
          is_active: true
        })

      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error('Failed to store integration data')
      }

      console.log('Integration stored successfully');

      return new Response(
        JSON.stringify({ success: true, company_name: companyName }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'disconnect') {
      console.log('Disconnecting integration...');
      
      // Disconnect integration
      const { error } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('user_id', user.id)

      if (error) {
        console.error('Disconnect error:', error);
        throw new Error('Failed to disconnect integration')
      }

      console.log('Integration disconnected successfully');

      return new Response(
        JSON.stringify({ success: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'get_status') {
      console.log('Getting integration status...');
      
      // Get integration status
      const { data, error } = await supabase
        .from('fortnox_integrations')
        .select('is_active, company_name, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Status check error:', error);
        throw new Error('Failed to get integration status')
      }

      console.log('Integration status:', { 
        connected: !!data,
        company_name: data?.company_name 
      });

      return new Response(
        JSON.stringify({ 
          connected: !!data,
          company_name: data?.company_name,
          connected_since: data?.created_at
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.error('Invalid action:', action);
    throw new Error('Invalid action')

  } catch (error) {
    console.error('Fortnox OAuth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
