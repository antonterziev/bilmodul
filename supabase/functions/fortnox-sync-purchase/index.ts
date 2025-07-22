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

    const { inventoryItemId } = await req.json()

    if (!inventoryItemId) {
      throw new Error('Missing inventoryItemId')
    }

    console.log('Starting Fortnox sync for inventory item:', inventoryItemId)

    // Get the inventory item details
    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single()

    if (itemError || !inventoryItem) {
      throw new Error('Inventory item not found')
    }

    // Check if already synced
    if (inventoryItem.fortnox_sync_status === 'synced') {
      console.log('Item already synced to Fortnox')
      return new Response(
        JSON.stringify({ success: true, message: 'Already synced' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user's Fortnox integration
    const { data: fortnoxIntegration, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (integrationError || !fortnoxIntegration) {
      throw new Error('No active Fortnox integration found')
    }

    // Prepare the verification data for Fortnox
    const verificationData = {
      Description: `Fordonsinköp - ${inventoryItem.brand} ${inventoryItem.model} (${inventoryItem.registration_number})`,
      TransactionDate: inventoryItem.purchase_date,
      VoucherRows: [
        {
          Account: 1465, // Fordon account
          Debit: inventoryItem.purchase_price,
          Description: `Inköp ${inventoryItem.brand} ${inventoryItem.model}`,
        },
        {
          Account: 1910, // Kassa/Bank account
          Credit: inventoryItem.purchase_price,
          Description: `Betalning ${inventoryItem.brand} ${inventoryItem.model}`,
        }
      ]
    }

    console.log('Creating verification in Fortnox:', verificationData)

    // Create log entry
    const { data: logEntry } = await supabaseClient
      .from('fortnox_sync_log')
      .insert({
        inventory_item_id: inventoryItemId,
        user_id: user.id,
        sync_type: 'purchase',
        sync_status: 'pending',
        sync_data: verificationData
      })
      .select()
      .single()

    try {
      // Call Fortnox API to create verification
      const fortnoxResponse = await fetch('https://api.fortnox.se/3/vouchers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fortnoxIntegration.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ Voucher: verificationData })
      })

      if (!fortnoxResponse.ok) {
        const errorText = await fortnoxResponse.text()
        console.error('Fortnox API error:', errorText)
        throw new Error(`Fortnox API error: ${fortnoxResponse.status} - ${errorText}`)
      }

      const fortnoxResult = await fortnoxResponse.json()
      const verificationNumber = fortnoxResult.Voucher?.VoucherNumber

      console.log('Verification created successfully:', verificationNumber)

      // Update inventory item with sync status
      await supabaseClient
        .from('inventory_items')
        .update({
          fortnox_sync_status: 'synced',
          fortnox_verification_number: verificationNumber,
          fortnox_synced_at: new Date().toISOString()
        })
        .eq('id', inventoryItemId)

      // Update sync log
      if (logEntry) {
        await supabaseClient
          .from('fortnox_sync_log')
          .update({
            sync_status: 'success',
            fortnox_verification_number: verificationNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', logEntry.id)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          verificationNumber,
          message: 'Vehicle successfully synced to Fortnox'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (fortnoxError) {
      console.error('Fortnox sync failed:', fortnoxError)
      
      // Update inventory item sync status
      await supabaseClient
        .from('inventory_items')
        .update({
          fortnox_sync_status: 'failed'
        })
        .eq('id', inventoryItemId)

      // Update sync log
      if (logEntry) {
        await supabaseClient
          .from('fortnox_sync_log')
          .update({
            sync_status: 'failed',
            error_message: fortnoxError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', logEntry.id)
      }

      throw fortnoxError
    }

  } catch (error) {
    console.error('Error in fortnox-sync-purchase:', error)
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