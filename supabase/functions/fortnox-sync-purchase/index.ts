
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
      console.error('No Fortnox integration found:', integrationError)
      throw new Error('No active Fortnox integration found. Please connect to Fortnox first.')
    }

    console.log('Found Fortnox integration:', {
      id: fortnoxIntegration.id,
      expires_at: fortnoxIntegration.token_expires_at,
      has_refresh_token: !!fortnoxIntegration.refresh_token
    })

    // Check if token is expired and refresh if needed
    let accessToken = fortnoxIntegration.access_token
    const tokenExpiresAt = new Date(fortnoxIntegration.token_expires_at)
    const now = new Date()
    const isTokenExpired = tokenExpiresAt <= now

    console.log('Token expiration check:', {
      expires_at: tokenExpiresAt.toISOString(),
      current_time: now.toISOString(),
      is_expired: isTokenExpired,
      minutes_until_expiry: Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60))
    })

    if (isTokenExpired) {
      console.log('Access token expired, attempting refresh...')
      
      if (!fortnoxIntegration.refresh_token) {
        console.error('No refresh token available')
        throw new Error('Access token expired and no refresh token available. Please reconnect to Fortnox.')
      }

      try {
        // Refresh the token
        const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
        const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
        
        if (!clientId || !clientSecret) {
          throw new Error('Missing Fortnox credentials for token refresh')
        }

        const credentials = btoa(`${clientId}:${clientSecret}`)
        
        const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: fortnoxIntegration.refresh_token
          })
        })

        const refreshData = await refreshResponse.json()

        console.log('Token refresh response:', {
          status: refreshResponse.status,
          ok: refreshResponse.ok,
          has_access_token: !!refreshData.access_token,
          has_refresh_token: !!refreshData.refresh_token,
          expires_in: refreshData.expires_in,
          error: refreshData.error
        })

        if (!refreshResponse.ok) {
          console.error('Token refresh failed:', refreshData)
          throw new Error(`Token refresh failed: ${refreshData.error || 'Unknown error'}. Please reconnect to Fortnox.`)
        }

        // Update the integration with new tokens
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000))
        
        const { error: updateError } = await supabaseClient
          .from('fortnox_integrations')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || fortnoxIntegration.refresh_token, // Keep old refresh token if new one not provided
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', fortnoxIntegration.id)

        if (updateError) {
          console.error('Failed to update tokens:', updateError)
          throw new Error('Failed to save refreshed tokens')
        }

        accessToken = refreshData.access_token
        console.log('Token successfully refreshed, new expiry:', newExpiresAt.toISOString())
        
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError)
        throw new Error(`Failed to refresh access token: ${refreshError.message}`)
      }
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
      console.log('Making Fortnox API call with access token:', accessToken.substring(0, 8) + '...')
      
      const fortnoxResponse = await fetch('https://api.fortnox.se/3/vouchers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ Voucher: verificationData })
      })

      const responseText = await fortnoxResponse.text()
      console.log('Fortnox API response:', {
        status: fortnoxResponse.status,
        statusText: fortnoxResponse.statusText,
        ok: fortnoxResponse.ok,
        body: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
      })

      if (!fortnoxResponse.ok) {
        console.error('Fortnox API error:', responseText)
        
        // Provide more specific error messages
        let errorMessage = `Fortnox API error: ${fortnoxResponse.status}`
        
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.ErrorInformation) {
            errorMessage = `Fortnox error: ${errorData.ErrorInformation.message || errorData.ErrorInformation.error}`
          }
        } catch (parseError) {
          // Use the raw response if JSON parsing fails
          errorMessage = `Fortnox API error: ${fortnoxResponse.status} - ${responseText}`
        }
        
        throw new Error(errorMessage)
      }

      const fortnoxResult = JSON.parse(responseText)
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
