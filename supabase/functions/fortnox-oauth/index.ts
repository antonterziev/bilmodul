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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, code, state } = await req.json()
    
    // Get user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    if (action === 'get_auth_url') {
      // Generate OAuth URL for Fortnox
      const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
      const redirectUri = 'https://lagermodulen.se/dashboard'
      const stateParam = crypto.randomUUID()
      
      const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=article customer invoice&` +
        `state=${stateParam}&` +
        `response_type=code&` +
        `access_type=offline`

      // Store state for verification
      await supabase
        .from('fortnox_integrations')
        .upsert({
          user_id: user.id,
          access_token: stateParam, // Temporarily store state here
          is_active: false
        })

      return new Response(
        JSON.stringify({ auth_url: authUrl, state: stateParam }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'exchange_code') {
      // Exchange authorization code for access token
      const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
      const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
      const redirectUri = 'https://lagermodulen.se/dashboard'

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

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Fortnox token exchange failed:', errorText)
        throw new Error('Failed to exchange code for token')
      }

      const tokenData = await tokenResponse.json()
      
      // Get company info from Fortnox
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
      }

      // Store tokens in database
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

      return new Response(
        JSON.stringify({ success: true, company_name: companyName }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'disconnect') {
      // Disconnect integration
      const { error } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('user_id', user.id)

      if (error) {
        throw new Error('Failed to disconnect integration')
      }

      return new Response(
        JSON.stringify({ success: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'get_status') {
      // Get integration status
      const { data, error } = await supabase
        .from('fortnox_integrations')
        .select('is_active, company_name, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        throw new Error('Failed to get integration status')
      }

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