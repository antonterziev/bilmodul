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
    console.log(`🔍 Looking for Fortnox integration for user: ${inventoryItem.user_id}`)
    
    const { data: fortnoxIntegration, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', inventoryItem.user_id)
      .eq('is_active', true)
      .maybeSingle()

    console.log(`🔍 Fortnox integration query result:`, { fortnoxIntegration, integrationError })

    if (integrationError) {
      console.error('❌ Database error when fetching Fortnox integration:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Database error when fetching Fortnox integration', details: integrationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!fortnoxIntegration) {
      console.error('❌ No active Fortnox integration found for user:', inventoryItem.user_id)
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found. Please connect to Fortnox first.' }),
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

        // 🔎 Step: Lookup or create supplier "Veksla Bilhandel"
        let supplierNumber: string | undefined;
        try {
          const supplierRes = await fetch(`https://api.fortnox.se/3/suppliers`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Access-Token': clientSecret,
              'Accept': 'application/json'
            }
          });

          const suppliersText = await supplierRes.text();
          if (!supplierRes.ok) throw new Error(`Failed to fetch suppliers: ${suppliersText}`);

          const suppliers = JSON.parse(suppliersText)?.Suppliers ?? [];
          const vekslaSupplier = suppliers.find(s => s.Name === 'Veksla Bilhandel');

          if (vekslaSupplier) {
            supplierNumber = vekslaSupplier.SupplierNumber;
            console.log(`📦 Found existing supplier: ${supplierNumber}`);
          } else {
            // Supplier not found – create it
            console.log('➕ Supplier "Veksla Bilhandel" not found, creating...');
            const createSupplierRes = await fetch('https://api.fortnox.se/3/suppliers', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Access-Token': clientSecret,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                Supplier: {
                  Name: 'Veksla Bilhandel',
                  OrganizationNumber: '000000-0000', // Dummy, adjust if needed
                  City: 'Stockholm',
                  Country: 'SE'
                }
              })
            });

            const supplierCreateText = await createSupplierRes.text();
            if (!createSupplierRes.ok) throw new Error(`Failed to create supplier: ${supplierCreateText}`);

            const newSupplier = JSON.parse(supplierCreateText)?.Supplier;
            supplierNumber = newSupplier?.SupplierNumber;
            if (!supplierNumber) throw new Error('Missing supplier number after creation');
            console.log(`✅ Created supplier: ${supplierNumber}`);
          }
        } catch (supplierErr) {
          console.error('❌ Supplier handling error:', supplierErr);
          return new Response(JSON.stringify({
            error: 'Supplier handling failed',
            details: supplierErr.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        // 🧾 Step: Create supplier invoice
        try {
          const invoicePayload = {
            SupplierInvoice: {
              SupplierNumber: supplierNumber,
              Project: fortnoxProjectId,
              SupplierInvoiceRows: [
                {
                  Account: 4010,
                  Project: fortnoxProjectId,
                  Description: `${inventoryItem.brand} ${inventoryItem.model}`,
                  Quantity: 1,
                  UnitPrice: inventoryItem.purchase_price,
                  VAT: 0
                }
              ]
            }
          };

          const createInvoiceRes = await fetch('https://api.fortnox.se/3/supplierinvoices', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Access-Token': clientSecret,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(invoicePayload)
          });

          const invoiceText = await createInvoiceRes.text();
          if (!createInvoiceRes.ok) {
            console.error('❌ Failed to create supplier invoice:', invoiceText);
            return new Response(JSON.stringify({
              error: 'Failed to create Fortnox supplier invoice',
              details: invoiceText
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          const invoiceData = JSON.parse(invoiceText);
          const invoiceNumber = invoiceData?.SupplierInvoice?.DocumentNumber;
          console.log(`✅ Supplier invoice created: ${invoiceNumber}`);

          // Optional: Save invoice number
          await supabaseClient.from('inventory_items').update({
            fortnox_invoice_number: invoiceNumber
          }).eq('id', inventoryItemId);

        } catch (invoiceError) {
          console.error('❌ Error during supplier invoice creation:', invoiceError);
          return new Response(JSON.stringify({
            error: 'Error during supplier invoice creation',
            details: invoiceError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Fortnox project and supplier invoice created successfully',
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