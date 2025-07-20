import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FortnoxTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

interface FortnoxCompanyInfo {
  CompanyInformation: {
    CompanyName: string
    OrganizationNumber: string
  }[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid token')
    }

    const { action, code, state } = await req.json()

    if (action === 'get_auth_url') {
      // Generate authorization URL
      const clientId = 'RLpVBfg8tb46'
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`
      const scope = 'companyinformation,article,customer,invoice'
      const authState = `${user.id}_${Date.now()}`
      
      const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${authState}&` +
        `access_type=offline&` +
        `response_type=code`

      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'exchange_code') {
      // Exchange authorization code for access token
      const clientId = 'RLpVBfg8tb46'
      const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`

      if (!clientSecret) {
        throw new Error('Fortnox client secret not configured')
      }

      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Token exchange failed:', errorText)
        throw new Error(`Token exchange failed: ${tokenResponse.status}`)
      }

      const tokenData: FortnoxTokenResponse = await tokenResponse.json()

      // Get company information
      const companyResponse = await fetch('https://api.fortnox.se/3/companyinformation', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      })

      let companyName = ''
      if (companyResponse.ok) {
        const companyData: FortnoxCompanyInfo = await companyResponse.json()
        companyName = companyData.CompanyInformation?.[0]?.CompanyName || ''
      }

      // Store the integration
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      
      const { error: insertError } = await supabase
        .from('fortnox_integrations')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          company_name: companyName,
          is_active: true,
        })

      if (insertError) {
        console.error('Failed to store integration:', insertError)
        throw new Error('Failed to store integration')
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          company_name: companyName,
          expires_at: expiresAt 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'refresh_token') {
      // Refresh the access token
      const { data: integration } = await supabase
        .from('fortnox_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!integration || !integration.refresh_token) {
        throw new Error('No active integration found')
      }

      const clientId = 'RLpVBfg8tb46'
      const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')

      if (!clientSecret) {
        throw new Error('Fortnox client secret not configured')
      }

      const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token')
      }

      const refreshData: FortnoxTokenResponse = await refreshResponse.json()
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()

      const { error: updateError } = await supabase
        .from('fortnox_integrations')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || integration.refresh_token,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id)

      if (updateError) {
        throw new Error('Failed to update token')
      }

      return new Response(
        JSON.stringify({ success: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'disconnect') {
      // Disconnect the integration
      const { error: updateError } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('user_id', user.id)

      if (updateError) {
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

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Fortnox OAuth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})