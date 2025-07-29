import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { inventoryItemId } = await req.json()

    if (!inventoryItemId) {
      return new Response(
        JSON.stringify({ error: 'Missing inventoryItemId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🚀 Starting VMB project creation for inventory item: ${inventoryItemId}`)

    // Get inventory item details
    const { data: inventoryItem, error: inventoryError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .single()

    if (inventoryError || !inventoryItem) {
      console.error('❌ Failed to fetch inventory item:', inventoryError)
      return new Response(
        JSON.stringify({ error: 'Inventory item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if vehicle vat_type is VMB
    if (inventoryItem.vat_type !== 'Vinstmarginalbeskattning (VMB)') {
      console.log(`ℹ️ Vehicle vat_type is ${inventoryItem.vat_type}, not VMB. Skipping project creation.`)
      return new Response(
        JSON.stringify({ message: 'Vehicle vat_type is not VMB, project creation skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's active Fortnox integration
    const { data: fortnoxIntegration, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', inventoryItem.user_id)
      .eq('is_active', true)
      .single()

    if (integrationError || !fortnoxIntegration) {
      console.error('❌ No active Fortnox integration found:', integrationError)
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
    if (!clientSecret) {
      console.error('❌ FORTNOX_CLIENT_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'Fortnox client secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = fortnoxIntegration.access_token

    // Check if access token needs refresh
    if (fortnoxIntegration.expires_at && new Date(fortnoxIntegration.expires_at) <= new Date()) {
      console.log('🔄 Access token expired, refreshing...')
      
      const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: fortnoxIntegration.refresh_token,
          client_id: Deno.env.get('FORTNOX_CLIENT_ID') || '',
          client_secret: clientSecret,
        }),
      })

      if (!refreshResponse.ok) {
        console.error('❌ Failed to refresh access token:', await refreshResponse.text())
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Fortnox access token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update the integration with new tokens
      await supabaseClient
        .from('fortnox_integrations')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', fortnoxIntegration.id)
    }

    // 🔨 Step: Create a Fortnox Project for this vehicle using its registration number
    try {
      const projectPayload = {
        Project: {
          ProjectNumber: inventoryItem.registration_number, // Must be unique
          Description: `${inventoryItem.brand} ${inventoryItem.model}`,
          Status: 'ONGOING',
          Comments: `Auto-created for inventory ID ${inventoryItemId}`
        }
      };

      const createProjectRes = await fetch('https://api.fortnox.se/3/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Access-Token': clientSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(projectPayload)
      });

      const projectResponseText = await createProjectRes.text();

      if (!createProjectRes.ok) {
        console.error('❌ Failed to create project:', projectResponseText);
        return new Response(
          JSON.stringify({ error: 'Failed to create Fortnox project', details: projectResponseText }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        const projectData = JSON.parse(projectResponseText);
        const fortnoxProjectId = projectData?.Project?.ProjectNumber;
        console.log(`✅ Fortnox project created: ${fortnoxProjectId}`);

        // Store project number in inventory_items
        await supabaseClient
          .from('inventory_items')
          .update({ fortnox_project_number: fortnoxProjectId })
          .eq('id', inventoryItemId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Fortnox project created successfully',
            projectNumber: fortnoxProjectId 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (projectError) {
      console.error('❌ Error during Fortnox project creation:', projectError);
      return new Response(
        JSON.stringify({ error: 'Error during project creation', details: projectError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})