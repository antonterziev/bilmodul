import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get API documentation from fortnox-docs function
async function getFortnoxApiDocs(endpoint?: string, method?: string) {
  try {
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('//', '//').replace(/\/$/, '');
    const docsUrl = `${baseUrl}/functions/v1/fortnox-docs`;
    
    let url = docsUrl;
    if (endpoint || method) {
      const params = new URLSearchParams();
      params.append('action', 'search');
      if (endpoint) params.append('endpoint', endpoint);
      if (method) params.append('method', method);
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('📚 Could not fetch API docs:', error.message);
  }
  return null;
}

serve(async (req) => {
  console.log('🚀 Function invoked, method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Returning CORS preflight response');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('✅ Supabase client created');

    console.log('🚀 NEW VERSION: fortnox-momsi-inkop function started')
    
    console.log('📥 Reading request body...');
    let requestData;
    try {
      requestData = await req.json();
      console.log('📥 Successfully parsed request body:', requestData);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { inventoryItemId, syncingUserId } = requestData;
    console.log('📥 Request data:', { inventoryItemId, syncingUserId })

    if (!inventoryItemId) {
      return new Response(
        JSON.stringify({ error: 'Missing inventoryItemId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🚀 Starting MOMSI project creation for inventory item: ${inventoryItemId}, syncing user: ${syncingUserId}`)

    // Get inventory item details
    const { data: inventoryItem, error: inventoryError } = await supabase
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

    // Check if vehicle vat_type is MOMSI
    if (inventoryItem.vat_type !== 'MOMSI') {
      console.log(`ℹ️ Vehicle vat_type is ${inventoryItem.vat_type}, not MOMSI. Skipping project creation.`)
      return new Response(
        JSON.stringify({ message: 'Vehicle vat_type is not MOMSI, project creation skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the syncing user's organization
    console.log(`🔍 Getting organization for syncing user: ${syncingUserId}`)
    const { data: syncingUserProfile, error: syncingUserError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', syncingUserId)
      .single()

    console.log(`📋 Syncing user profile result:`, { syncingUserProfile, syncingUserError })

    if (syncingUserError || !syncingUserProfile) {
      console.error('❌ Failed to fetch syncing user profile:', syncingUserError)
      return new Response(
        JSON.stringify({ error: 'Syncing user profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if inventory item belongs to the same organization
    if (inventoryItem.organization_id !== syncingUserProfile.organization_id) {
      console.error('❌ Organization mismatch:', { 
        inventory_org: inventoryItem.organization_id, 
        syncing_user_org: syncingUserProfile.organization_id 
      })
      return new Response(
        JSON.stringify({ error: 'Cannot sync vehicles from different organizations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look for ANY active Fortnox integration within the same organization
    console.log(`🔍 Looking for Fortnox integration for organization: ${syncingUserProfile.organization_id}`)
    
    // First, get all users in the same organization
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('organization_id', syncingUserProfile.organization_id)

    if (orgUsersError) {
      console.error('❌ Error fetching organization users:', orgUsersError)
      return new Response(
        JSON.stringify({ error: 'Error fetching organization users', details: orgUsersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userIds = orgUsers.map(u => u.user_id)
    console.log(`🔍 Found ${userIds.length} users in organization`)

    // Now find any active Fortnox integration for these users
    const { data: fortnoxIntegration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
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
      console.error('❌ No active Fortnox integration found for organization:', syncingUserProfile.organization_id)
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found for your organization. Please connect to Fortnox first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
    console.log('🔍 FORTNOX_CLIENT_SECRET configured:', !!clientSecret);
    if (!clientSecret) {
      console.error('❌ FORTNOX_CLIENT_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'Fortnox client secret not configured. Please configure FORTNOX_CLIENT_SECRET in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accessToken = fortnoxIntegration.access_token

    // Check if access token needs refresh
    if (fortnoxIntegration.token_expires_at && new Date(fortnoxIntegration.token_expires_at) <= new Date()) {
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
      await supabase
        .from('fortnox_integrations')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', fortnoxIntegration.id)
    }

    // 🔨 Step: Create a Fortnox Project for this vehicle using its registration number
    try {
      // Get API documentation for projects endpoint
      const projectDocs = await getFortnoxApiDocs('/projects', 'POST');
      console.log('📚 Using API documentation for projects:', projectDocs?.results?.[0]?.summary || 'No docs available');

      const projectPayload = {
        Project: {
          ProjectNumber: inventoryItem.registration_number, // Must be unique
          Description: `${inventoryItem.brand} ${inventoryItem.model}`,
          Status: 'ONGOING',
          StartDate: inventoryItem.purchase_date || new Date().toISOString().split('T')[0], // Use purchase date as start date
          Comments: `Auto-created for MOMSI inventory ID ${inventoryItemId}`
        }
      };

      console.log('📤 Creating project with payload:', JSON.stringify(projectPayload, null, 2));

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
      console.log('📥 Project API response:', {
        status: createProjectRes.status,
        statusText: createProjectRes.statusText,
        response: projectResponseText
      });

      let projectNumber: string;
      
      if (!createProjectRes.ok) {
        // Check if error is "project number already in use"
        const errorData = JSON.parse(projectResponseText);
        if (errorData?.ErrorInformation?.code === 2001182) {
          console.log('⚠️ Project number already exists, fetching existing project');
          
          // Fetch the existing project
          const getProjectRes = await fetch(`https://api.fortnox.se/3/projects/${inventoryItem.registration_number}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Access-Token': clientSecret,
              'Accept': 'application/json'
            }
          });

          if (!getProjectRes.ok) {
            const getProjectText = await getProjectRes.text();
            console.error('❌ Failed to fetch existing project:', getProjectText);
            
            await supabase.from('fortnox_errors_log').insert({
              user_id: inventoryItem.user_id,
              type: 'project_fetch_failed',
              message: `Failed to fetch existing project: ${getProjectText}`,
              context: {
                inventory_item_id: inventoryItemId,
                registration_number: inventoryItem.registration_number,
                response_status: getProjectRes.status
              }
            });

            return new Response(
              JSON.stringify({ error: 'Failed to fetch existing Fortnox project', details: getProjectText }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          const getProjectText = await getProjectRes.text();
          const existingProjectData = JSON.parse(getProjectText);
          projectNumber = existingProjectData?.Project?.ProjectNumber || inventoryItem.registration_number;
          console.log(`✅ Using existing Fortnox project: ${projectNumber}`);
        } else {
          // Different error, log and return
          console.error('❌ Failed to create project:', projectResponseText);
          
          await supabase.from('fortnox_errors_log').insert({
            user_id: inventoryItem.user_id,
            type: 'project_creation_failed',
            message: `Failed to create project: ${projectResponseText}`,
            context: {
              inventory_item_id: inventoryItemId,
              registration_number: inventoryItem.registration_number,
              project_payload: projectPayload,
              response_status: createProjectRes.status
            }
          });

          return new Response(
            JSON.stringify({ error: 'Failed to create Fortnox project', details: projectResponseText }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const projectData = JSON.parse(projectResponseText);
        projectNumber = projectData?.Project?.ProjectNumber || inventoryItem.registration_number;
        console.log(`✅ Fortnox project created: ${projectNumber}`);
      }

      // Force project to fully "activate" inside Fortnox by updating it twice
      const baseProjectPayload = {
        ProjectNumber: projectNumber,
        Description: `${inventoryItem.brand} ${inventoryItem.model}`,
        Status: 'ONGOING',
        StartDate: inventoryItem.purchase_date || new Date().toISOString().split('T')[0]
      };

      // First PUT with comment A
      const putPayloadA = {
        Project: {
          ...baseProjectPayload,
          Comments: `Activation pass A for MOMSI inventory ID ${inventoryItemId}`
        }
      };

      await fetch(`https://api.fortnox.se/3/projects/${projectNumber}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Access-Token': clientSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(putPayloadA)
      });

      // Second PUT with comment B
      const putPayloadB = {
        Project: {
          ...baseProjectPayload,
          Comments: `Activation pass B for MOMSI inventory ID ${inventoryItemId}`
        }
      };

      await fetch(`https://api.fortnox.se/3/projects/${projectNumber}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Access-Token': clientSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(putPayloadB)
      });

      // Store project number in inventory_items
      await supabase
        .from('inventory_items')
        .update({ fortnox_project_number: projectNumber })
        .eq('id', inventoryItemId);

      // 🧾 Step: Create supplier invoice with proper MOMSI (EU) accounting
      console.log('📋 Creating supplier invoice with MOMSI (EU) accounting...');
      try {
        // Get user-configured account numbers from the account_mappings table
        console.log('🔍 Looking up user-configured account numbers from database...');
        console.log('🔍 Organization ID:', syncingUserProfile.organization_id);
        
        const { data: accountMappings, error: mappingsError } = await supabase
          .from('account_mappings')
          .select('account_name, account_number')
          .eq('organization_id', syncingUserProfile.organization_id);

        console.log('📋 Account mappings query result:', { accountMappings, mappingsError });

        if (mappingsError) {
          console.error('❌ Error fetching account mappings:', mappingsError);
          throw new Error(`Failed to fetch account mappings: ${mappingsError.message}`);
        }

        console.log('📋 Found account mappings:', accountMappings);

        // Create a mapping object for easy lookup
        const accountNumberMap: {[key: string]: string} = {};
        accountMappings?.forEach(mapping => {
          accountNumberMap[mapping.account_name] = mapping.account_number;
        });

        // Get account numbers - use user configured or fallback to defaults for MOMSI (EU)
        const momsiEuAccountNumber = accountNumberMap['Lager - Momsbilar - EU'] || '1412';
        const leverantorskulderAccountNumber = accountNumberMap['Leverantörsskulder'] || '2440';
        const forskottsbetalningAccountNumber = accountNumberMap['Förskottsbetalning'] || '1680';

        console.log(`📋 Using MOMSI EU account number: ${momsiEuAccountNumber} (user configured: ${!!accountNumberMap['Lager - Momsbilar - EU']})`);
        console.log(`📋 Using Leverantörsskulder account number: ${leverantorskulderAccountNumber} (user configured: ${!!accountNumberMap['Leverantörsskulder']})`);
        console.log(`📋 Using Förskottsbetalning account number: ${forskottsbetalningAccountNumber} (user configured: ${!!accountNumberMap['Förskottsbetalning']})`);
        
        console.log(`📋 NEW VERSION - Skipping account validation - proceeding with MOMSI supplier invoice creation`);
        
        // Get API documentation for supplier invoices endpoint
        const invoiceDocs = await getFortnoxApiDocs('/supplierinvoices', 'POST');
        console.log('📚 Using API documentation for supplier invoices:', JSON.stringify(invoiceDocs, null, 2));

        // Create the invoice payload with proper balancing and purchase date for MOMSI (EU)
        let invoicePayload;
        
        // Check for down payment and prepare rows accordingly
        const downPaymentAmount = inventoryItem.down_payment || 0;
        console.log(`💰 Down payment amount: ${downPaymentAmount}`);
        
        // For MOMSI (EU), calculate VAT as 25% of purchase price for Fortnox automatic handling
        const grossAmount = inventoryItem.purchase_price;
        const vatRate = 0.25;
        const vatAmount = grossAmount * vatRate / (1 + vatRate);
        const netAmount = grossAmount - vatAmount;
        
        console.log(`💰 Gross amount: ${grossAmount}`);
        console.log(`💰 VAT amount (25% for automatic handling): ${vatAmount}`);
        console.log(`💰 Net amount: ${netAmount}`);
        
        // Calculate the net amount to be invoiced (gross amount - down payment)
        const netInvoiceAmount = grossAmount - downPaymentAmount;
        console.log(`💰 Net invoice amount (gross - down payment): ${netInvoiceAmount}`);

        // Build rows for MOMSI (EU) - only asset and down payment if applicable, let Fortnox handle VAT automatically
        const supplierInvoiceRows = [
          {
            Account: momsiEuAccountNumber, // e.g., 1412 - Lager - Momsbilar - EU
            Debit: netAmount,
            Credit: 0.0,
            Project: projectNumber
          }
        ];

        // If down payment exists, add credit entry
        if (downPaymentAmount && downPaymentAmount > 0) {
          supplierInvoiceRows.push({
            Account: forskottsbetalningAccountNumber,
            Credit: downPaymentAmount,
            Debit: 0.0,
            Project: projectNumber
          });
        }

        invoicePayload = {
          SupplierInvoice: {
            SupplierNumber: "1",
            InvoiceNumber: `MOMSI-${inventoryItem.registration_number}`,
            InvoiceDate: inventoryItem.purchase_date || new Date().toISOString().split('T')[0],
            Project: projectNumber,
            Total: netInvoiceAmount,
            VAT: vatAmount, // 25% VAT for automatic Fortnox handling
            SupplierInvoiceRows: supplierInvoiceRows
          }
        };

        console.log('📤 Creating MOMSI supplier invoice with payload:', JSON.stringify(invoicePayload, null, 2));

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
        console.log('📥 MOMSI supplier invoice API response:', {
          status: createInvoiceRes.status,
          statusText: createInvoiceRes.statusText,
          response: invoiceText
        });

        if (!createInvoiceRes.ok) {
          console.error('❌ Failed to create MOMSI supplier invoice:', invoiceText);
          
          // Log error to database for debugging
          await supabase.from('fortnox_errors_log').insert({
            user_id: inventoryItem.user_id,
            type: 'momsi_supplier_invoice_creation_failed',
            message: `Failed to create MOMSI supplier invoice: ${invoiceText}`,
            context: {
              inventory_item_id: inventoryItemId,
              project_id: projectNumber,
              invoice_payload: invoicePayload,
              response_status: createInvoiceRes.status
            }
          });

          return new Response(JSON.stringify({
            error: 'Failed to create Fortnox MOMSI supplier invoice',
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
        console.log(`✅ MOMSI supplier invoice created: ${invoiceNumber}`);

        // Save invoice number and update sync status
        await supabase.from('inventory_items').update({
          fortnox_invoice_number: invoiceNumber,
          fortnox_sync_status: 'synced',
          fortnox_synced_at: new Date().toISOString(),
          fortnox_synced_by_user_id: syncingUserId
        }).eq('id', inventoryItemId);

        // Log successful sync
        await supabase.from('fortnox_sync_log').insert({
          user_id: inventoryItem.user_id,
          synced_by_user_id: syncingUserId,
          inventory_item_id: inventoryItemId,
          sync_type: 'momsi_eu_invoice',
          sync_status: 'success',
          fortnox_verification_number: invoiceNumber,
          sync_data: {
            project_number: projectNumber,
            invoice_number: invoiceNumber,
            fortnox_integration_id: fortnoxIntegration.id,
            down_payment_processed: downPaymentAmount > 0
          }
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Fortnox MOMSI project and supplier invoice created successfully',
            projectNumber: projectNumber,
            invoiceNumber: invoiceNumber,
            downPaymentProcessed: downPaymentAmount > 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (invoiceError) {
        console.error('❌ Error during MOMSI supplier invoice creation:', invoiceError);
        
        // Log error to database
        await supabase.from('fortnox_errors_log').insert({
          user_id: inventoryItem.user_id,
          type: 'momsi_supplier_invoice_error',
          message: `Error during MOMSI supplier invoice creation: ${invoiceError.message}`,
          context: {
            inventory_item_id: inventoryItemId,
            error_stack: invoiceError.stack
          }
        });

        return new Response(JSON.stringify({
          error: 'Error during MOMSI supplier invoice creation',
          details: invoiceError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
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