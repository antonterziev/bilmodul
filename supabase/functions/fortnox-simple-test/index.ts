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
    console.log('Starting simple sync test...')
    
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

    const { inventoryItemId } = await req.json()
    if (!inventoryItemId) {
      throw new Error('Missing inventoryItemId')
    }

    console.log('Getting inventory item...')
    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single()

    if (itemError || !inventoryItem) {
      console.log('Item error:', itemError)
      throw new Error('Inventory item not found')
    }

    console.log('Getting Fortnox integration...')
    const { data: fortnoxIntegrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (integrationError) {
      console.log('Integration error:', integrationError)
      throw new Error('Error fetching Fortnox integration')
    }

    if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      throw new Error('No active Fortnox integration found')
    }

    const fortnoxIntegration = fortnoxIntegrations[0]

    console.log('Testing Fortnox API call...')
    
    // First just test a simple GET to see if our token works
    const testResponse = await fetch('https://api.fortnox.se/3/companyinformation', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
        'Accept': 'application/json'
      }
    })

    const testText = await testResponse.text()
    console.log('Company info test:', testResponse.status, testText.substring(0, 200))

    if (!testResponse.ok) {
      throw new Error(`Company info test failed: ${testResponse.status}`)
    }

    // Now test creating a simple voucher
    const voucherData = {
      Description: `Test voucher`,
      TransactionDate: '2025-07-22',
      VoucherRows: [
        {
          Account: 1200,
          Debit: 100,
          Description: 'Test debit'
        },
        {
          Account: 1930,
          Credit: 100,
          Description: 'Test credit'
        }
      ]
    }

    console.log('Creating test voucher...')
    const voucherResponse = await fetch('https://api.fortnox.se/3/vouchers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ Voucher: voucherData })
    })

    const voucherText = await voucherResponse.text()
    console.log('Voucher response:', voucherResponse.status, voucherText.substring(0, 500))

    return new Response(
      JSON.stringify({ 
        success: true,
        companyInfoStatus: testResponse.status,
        voucherStatus: voucherResponse.status,
        voucherResponse: voucherText.substring(0, 500)
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