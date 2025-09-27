import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: fortnoxIntegrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (integrationError || !fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      throw new Error('No active Fortnox integration found')
    }

    const fortnoxIntegration = fortnoxIntegrations[0]

    // Get all accounts from Fortnox
    console.log('Fetching accounts from Fortnox...')
    const accountsResponse = await fetch('https://api.fortnox.se/3/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
        'Accept': 'application/json'
      }
    })

    const accountsText = await accountsResponse.text()
    console.log('Accounts response status:', accountsResponse.status)

    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`)
    }

    const accountsData = JSON.parse(accountsText)
    const accounts = accountsData.Accounts || []

    // Filter for commonly used accounts for vehicles/equipment and bank accounts
    const relevantAccounts = accounts.filter((account: any) => {
      const number = parseInt(account.Number)
      const description = account.Description?.toLowerCase() || ''
      
      // Look for asset accounts (1000-1999) and bank accounts (1900-1999)
      return (
        (number >= 1000 && number <= 1999) || // Assets
        description.includes('inventarie') ||
        description.includes('utrustning') ||
        description.includes('maskin') ||
        description.includes('fordon') ||
        description.includes('bank') ||
        description.includes('kassa') ||
        description.includes('check')
      )
    })

    console.log(`Found ${accounts.length} total accounts, ${relevantAccounts.length} relevant ones`)

    return new Response(
      JSON.stringify({ 
        success: true,
        totalAccounts: accounts.length,
        relevantAccounts: relevantAccounts.map((acc: any) => ({
          number: acc.Number,
          description: acc.Description,
          active: acc.Active
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})