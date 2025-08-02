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

    // Get all suppliers from Fortnox
    console.log('Fetching suppliers from Fortnox...')
    const suppliersResponse = await fetch('https://api.fortnox.se/3/suppliers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
        'Accept': 'application/json'
      }
    })

    const suppliersText = await suppliersResponse.text()
    console.log('Suppliers response status:', suppliersResponse.status)

    if (!suppliersResponse.ok) {
      console.error('Suppliers response error:', suppliersText)
      // Check if it's a token expiration error
      if (suppliersResponse.status === 401) {
        throw new Error('Fortnox-anslutningen har gått ut. Vänligen anslut igen.')
      }
      throw new Error(`Failed to fetch suppliers: ${suppliersResponse.status}`)
    }

    const suppliersData = JSON.parse(suppliersText)
    const suppliers = suppliersData.Suppliers || []

    // Filter for active suppliers and sort by name
    const activeSuppliers = suppliers
      .filter(supplier => supplier.Active !== false)
      .map(supplier => ({
        supplierNumber: supplier.SupplierNumber,
        name: supplier.Name,
        organisationNumber: supplier.OrganisationNumber
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    console.log(`Found ${suppliers.length} total suppliers, ${activeSuppliers.length} active ones`)

    return new Response(
      JSON.stringify({ 
        success: true,
        suppliers: activeSuppliers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})