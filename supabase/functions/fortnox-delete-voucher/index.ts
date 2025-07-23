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

    const { inventoryItemId } = await req.json()

    if (!inventoryItemId) {
      throw new Error('Missing inventoryItemId')
    }

    console.log('Starting Fortnox voucher deletion for inventory item:', inventoryItemId)

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

    // Check if item was synced with Fortnox
    if (!inventoryItem.fortnox_verification_number || inventoryItem.fortnox_sync_status !== 'synced') {
      console.log('Item was not synced to Fortnox, no deletion needed')
      return new Response(
        JSON.stringify({ success: true, message: 'Item was not synced to Fortnox' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user's Fortnox integration
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
        throw new Error('Access token expired and no refresh token available. Please reconnect to Fortnox.')
      }

      try {
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

        if (!refreshResponse.ok) {
          throw new Error(`Token refresh failed: ${refreshData.error || 'Unknown error'}. Please reconnect to Fortnox.`)
        }

        // Update the integration with new tokens
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000))
        
        const { error: updateError } = await supabaseClient
          .from('fortnox_integrations')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || fortnoxIntegration.refresh_token,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', fortnoxIntegration.id)

        if (updateError) {
          throw new Error('Failed to save refreshed tokens')
        }

        accessToken = refreshData.access_token
        console.log('Token successfully refreshed')
        
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError)
        throw new Error(`Failed to refresh access token: ${refreshError.message}`)
      }
    }

    // Delete voucher from Fortnox
    console.log('Deleting voucher from Fortnox:', {
      voucherSeries: 'A',
      voucherNumber: inventoryItem.fortnox_verification_number
    })

    const deleteUrl = `https://api.fortnox.se/3/vouchers/A/${inventoryItem.fortnox_verification_number}`
    
    const fortnoxResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    console.log('Fortnox delete response:', {
      status: fortnoxResponse.status,
      statusText: fortnoxResponse.statusText,
      ok: fortnoxResponse.ok
    })

    if (!fortnoxResponse.ok) {
      const responseText = await fortnoxResponse.text()
      console.error('Fortnox deletion error:', responseText)
      
      let errorMessage = `Fortnox deletion error: ${fortnoxResponse.status}`
      
      try {
        const errorData = JSON.parse(responseText)
        if (errorData.ErrorInformation) {
          errorMessage = `Fortnox error: ${errorData.ErrorInformation.message || errorData.ErrorInformation.error}`
        }
      } catch (parseError) {
        errorMessage = `Fortnox deletion error: ${fortnoxResponse.status} - ${responseText}`
      }
      
      throw new Error(errorMessage)
    }

    console.log('Voucher successfully deleted from Fortnox')

    // Update inventory item to remove Fortnox sync info
    await supabaseClient
      .from('inventory_items')
      .update({
        fortnox_sync_status: 'pending',
        fortnox_verification_number: null,
        fortnox_synced_at: null
      })
      .eq('id', inventoryItemId)

    // Log the deletion
    await supabaseClient
      .from('fortnox_sync_log')
      .insert({
        inventory_item_id: inventoryItemId,
        user_id: user.id,
        sync_type: 'delete',
        sync_status: 'success',
        sync_data: {
          voucherSeries: 'A',
          voucherNumber: inventoryItem.fortnox_verification_number,
          deletedAt: new Date().toISOString()
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Voucher successfully deleted from Fortnox'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in fortnox-delete-voucher:', error)
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