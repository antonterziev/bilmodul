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
    console.log('=== DEBUG SYNC START ===')
    
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
      console.log('❌ User error:', userError)
      throw new Error('Unauthorized')
    }
    console.log('✅ User authenticated:', user.id)

    const { inventoryItemId } = await req.json()
    console.log('📦 Inventory item ID:', inventoryItemId)

    if (!inventoryItemId) {
      throw new Error('Missing inventoryItemId')
    }

    // Get the inventory item details
    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single()

    if (itemError || !inventoryItem) {
      console.log('❌ Item error:', itemError)
      throw new Error('Inventory item not found')
    }
    console.log('✅ Found inventory item:', inventoryItem.registration_number)

    // Get the user's Fortnox integration
    const { data: fortnoxIntegrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (integrationError) {
      console.log('❌ Integration error:', integrationError)
      throw new Error('Error fetching Fortnox integration')
    }

    if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      console.log('❌ No integrations found')
      throw new Error('No active Fortnox integration found')
    }

    const fortnoxIntegration = fortnoxIntegrations[0]
    console.log('✅ Found Fortnox integration')

    // Simple test with minimal verification data
    const verificationData = {
      Description: `Test - ${inventoryItem.registration_number}`,
      TransactionDate: inventoryItem.purchase_date,
      VoucherRows: [
        {
          Account: 1200,
          Debit: 1000, // Test with small amount
          Description: `Test inköp`,
        },
        {
          Account: 1930,
          Credit: 1000,
          Description: `Test betalning`,
        }
      ]
    }

    console.log('📝 Creating verification:', JSON.stringify(verificationData, null, 2))

    // Call Fortnox API
    const fortnoxResponse = await fetch('https://api.fortnox.se/3/vouchers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ Voucher: verificationData })
    })

    const responseText = await fortnoxResponse.text()
    console.log('🔄 Fortnox response status:', fortnoxResponse.status)
    console.log('🔄 Fortnox response:', responseText.substring(0, 500))

    if (!fortnoxResponse.ok) {
      console.log('❌ Fortnox API failed')
      
      let errorMessage = `Fortnox API error: ${fortnoxResponse.status}`
      try {
        const errorData = JSON.parse(responseText)
        if (errorData.ErrorInformation) {
          errorMessage = `Fortnox error: ${errorData.ErrorInformation.message || errorData.ErrorInformation.error}`
        }
      } catch (parseError) {
        errorMessage = `Fortnox API error: ${fortnoxResponse.status} - ${responseText}`
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMessage,
          details: responseText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Success!')
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test verification created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.log('💥 Error:', error.message)
    console.log('💥 Stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})