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

    const { action, inventory_item_id } = await req.json()
    
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

    // Get active Fortnox integration
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('No active Fortnox integration found')
    }

    if (action === 'sync_vehicle') {
      // Get vehicle data
      const { data: vehicle, error: vehicleError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', inventory_item_id)
        .eq('user_id', user.id)
        .single()

      if (vehicleError || !vehicle) {
        throw new Error('Vehicle not found')
      }

      // Create article in Fortnox
      const articleData = {
        ArticleNumber: vehicle.registration_number,
        Description: `${vehicle.brand} ${vehicle.model}`,
        PurchasePrice: vehicle.purchase_price,
        SalesPrice: vehicle.expected_selling_price || vehicle.purchase_price,
        Unit: 'st',
        AccountNumber: 3001, // Sales account
        PurchaseAccount: 4010, // Purchase account
        EUAccount: 3001,
        EUVATAccount: 2611,
        ExportAccount: 3001,
        Type: 'STOCK',
        Active: vehicle.status === 'på_lager'
      }

      const fortnoxResponse = await fetch('https://api.fortnox.se/3/articles/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Client-Secret': Deno.env.get('FORTNOX_CLIENT_SECRET'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Article: articleData })
      })

      if (!fortnoxResponse.ok) {
        const errorText = await fortnoxResponse.text()
        console.error('Fortnox article creation failed:', errorText)
        throw new Error('Failed to create article in Fortnox')
      }

      const fortnoxData = await fortnoxResponse.json()
      
      // Store sync record
      const { error: syncError } = await supabase
        .from('fortnox_article_sync')
        .upsert({
          user_id: user.id,
          inventory_item_id: vehicle.id,
          fortnox_article_number: fortnoxData.Article.ArticleNumber,
          sync_status: 'synced'
        })

      if (syncError) {
        console.error('Failed to store sync record:', syncError)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          article_number: fortnoxData.Article.ArticleNumber,
          message: 'Vehicle synced to Fortnox as article'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'sync_sale') {
      // Get vehicle and sync data
      const { data: vehicle, error: vehicleError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', inventory_item_id)
        .eq('user_id', user.id)
        .single()

      if (vehicleError || !vehicle) {
        throw new Error('Vehicle not found')
      }

      const { data: syncData, error: syncError } = await supabase
        .from('fortnox_article_sync')
        .select('*')
        .eq('inventory_item_id', vehicle.id)
        .eq('user_id', user.id)
        .single()

      if (syncError || !syncData) {
        throw new Error('Vehicle not synced to Fortnox yet')
      }

      // Update article status to inactive (sold)
      const updateData = {
        Active: false,
        Note: `Sold on ${vehicle.selling_date || new Date().toISOString().split('T')[0]}`
      }

      const fortnoxResponse = await fetch(`https://api.fortnox.se/3/articles/${syncData.fortnox_article_number}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Client-Secret': Deno.env.get('FORTNOX_CLIENT_SECRET'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Article: updateData })
      })

      if (!fortnoxResponse.ok) {
        const errorText = await fortnoxResponse.text()
        console.error('Fortnox article update failed:', errorText)
        throw new Error('Failed to update article in Fortnox')
      }

      // Update sync status
      await supabase
        .from('fortnox_article_sync')
        .update({ 
          sync_status: 'sold',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', syncData.id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sale synced to Fortnox - article marked as sold'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'sync_all_vehicles') {
      // Get all unsold vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'på_lager')

      if (vehiclesError) {
        throw new Error('Failed to fetch vehicles')
      }

      const results = []
      
      for (const vehicle of vehicles) {
        try {
          // Check if already synced
          const { data: existingSync } = await supabase
            .from('fortnox_article_sync')
            .select('id')
            .eq('inventory_item_id', vehicle.id)
            .single()

          if (existingSync) {
            results.push({
              registration_number: vehicle.registration_number,
              status: 'already_synced'
            })
            continue
          }

          // Create article in Fortnox
          const articleData = {
            ArticleNumber: vehicle.registration_number,
            Description: `${vehicle.brand} ${vehicle.model}`,
            PurchasePrice: vehicle.purchase_price,
            SalesPrice: vehicle.expected_selling_price || vehicle.purchase_price,
            Unit: 'st',
            AccountNumber: 3001,
            PurchaseAccount: 4010,
            EUAccount: 3001,
            EUVATAccount: 2611,
            ExportAccount: 3001,
            Type: 'STOCK',
            Active: true
          }

          const fortnoxResponse = await fetch('https://api.fortnox.se/3/articles/', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
              'Client-Secret': Deno.env.get('FORTNOX_CLIENT_SECRET'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ Article: articleData })
          })

          if (fortnoxResponse.ok) {
            const fortnoxData = await fortnoxResponse.json()
            
            // Store sync record
            await supabase
              .from('fortnox_article_sync')
              .insert({
                user_id: user.id,
                inventory_item_id: vehicle.id,
                fortnox_article_number: fortnoxData.Article.ArticleNumber,
                sync_status: 'synced'
              })

            results.push({
              registration_number: vehicle.registration_number,
              status: 'synced',
              article_number: fortnoxData.Article.ArticleNumber
            })
          } else {
            results.push({
              registration_number: vehicle.registration_number,
              status: 'failed'
            })
          }
        } catch (error) {
          results.push({
            registration_number: vehicle.registration_number,
            status: 'error',
            error: error.message
          })
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          message: `Synced ${results.filter(r => r.status === 'synced').length} vehicles to Fortnox`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Fortnox sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})