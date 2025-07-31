import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getFortnoxApiDocs = async (endpoint?: string, method?: string): Promise<any | null> => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase.functions.invoke('fortnox-docs', {
      body: { endpoint, method }
    });

    if (error) {
      console.error('Error fetching Fortnox API docs:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getFortnoxApiDocs:', error);
    return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { inventoryItemId, syncingUserId } = await req.json();
    console.log('Starting MOMSI sync for:', { inventoryItemId, syncingUserId });
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    if (!inventoryItemId) {
      return new Response(
        JSON.stringify({ error: 'inventoryItemId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get inventory item details
    console.log('Fetching inventory item with ID:', inventoryItemId);
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .single();

    if (inventoryError || !inventoryItem) {
      console.error('Error fetching inventory item:', inventoryError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inventory item' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Inventory item fetched successfully:', {
      id: inventoryItem.id,
      registration_number: inventoryItem.registration_number,
      vat_type: inventoryItem.vat_type,
      organization_id: inventoryItem.organization_id
    });

    // Verify this is a MOMSI item
    if (inventoryItem.vat_type !== 'MOMSI') {
      console.error('Invalid VAT type for MOMSI function:', inventoryItem.vat_type);
      return new Response(
        JSON.stringify({ error: 'This function only handles MOMSI inventory items' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get syncing user's profile to validate organization
    const { data: syncingProfile, error: syncingProfileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', syncingUserId)
      .single();

    if (syncingProfileError || !syncingProfile) {
      console.error('Error fetching syncing user profile:', syncingProfileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch syncing user profile' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify that the inventory item belongs to the same organization as the syncing user
    if (inventoryItem.organization_id !== syncingProfile.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Inventory item does not belong to the syncing user\'s organization' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Find active Fortnox integration for the organization
    const { data: fortnoxIntegrations, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('*')
      .eq('organization_id', inventoryItem.organization_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('Fortnox integration query result:', {
      integrations: fortnoxIntegrations,
      count: fortnoxIntegrations?.length,
      error: integrationError,
      organizationId: inventoryItem.organization_id
    });

    const fortnoxIntegration = fortnoxIntegrations?.[0];

    if (integrationError) {
      console.error('Database error fetching Fortnox integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Database error fetching Fortnox integration' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!fortnoxIntegration) {
      console.error('No active Fortnox integration found for organization:', inventoryItem.organization_id);
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found for this organization' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const FORTNOX_CLIENT_SECRET = Deno.env.get('FORTNOX_CLIENT_SECRET');
    if (!FORTNOX_CLIENT_SECRET) {
      console.error('FORTNOX_CLIENT_SECRET not found in environment');
      return new Response(
        JSON.stringify({ error: 'Fortnox client secret not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let accessToken = fortnoxIntegration.access_token;

    // Check if token is expired and refresh if needed
    const tokenExpiresAt = new Date(fortnoxIntegration.expires_at);
    const now = new Date();
    
    if (now >= tokenExpiresAt) {
      console.log('Access token expired, refreshing...');
      
      const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: fortnoxIntegration.refresh_token,
          client_id: fortnoxIntegration.client_id,
          client_secret: FORTNOX_CLIENT_SECRET,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to refresh Fortnox token',
            requiresReconnection: true,
            message: 'Fortnox-anslutningen har gått ut. Vänligen anslut igen.'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      
      // Update the integration with new tokens
      const newExpiresAt = new Date(now.getTime() + (refreshData.expires_in * 1000));
      
      await supabase
        .from('fortnox_integrations')
        .update({
          access_token: accessToken,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', fortnoxIntegration.id);

      console.log('Token refreshed successfully');
    }

    // Create Fortnox project
    const projectNumber = inventoryItem.registration_number;
    
    let fortnoxProjectNumber = projectNumber;
    
    const projectPayload = {
      Project: {
        ProjectNumber: projectNumber,
        Description: `Fordon ${inventoryItem.registration_number} - ${inventoryItem.brand} ${inventoryItem.model}`,
        Status: "ONGOING",
        StartDate: new Date().toISOString().split('T')[0],
      }
    };

    console.log('Creating Fortnox project with payload:', JSON.stringify(projectPayload, null, 2));

    const projectResponse = await fetch(`https://api.fortnox.se/3/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectPayload),
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      console.error('Failed to create project:', errorText);
      console.error('Project response status:', projectResponse.status);
      console.error('Full project error response:', {
        status: projectResponse.status,
        statusText: projectResponse.statusText,
        errorText,
        projectNumber
      });
      
      // Check if project already exists (Swedish error message patterns)
      if (projectResponse.status === 400 && (
        errorText.toLowerCase().includes('används redan') || 
        errorText.toLowerCase().includes('already exists') ||
        errorText.toLowerCase().includes('projektnummer') ||
        errorText.includes('2001182') // Fortnox error code for duplicate project number
      )) {
        console.log('Project already exists, using existing project number:', projectNumber);
        fortnoxProjectNumber = projectNumber;
      } else {
        console.error('Project creation failed with unhandled error:', errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create Fortnox project', 
            details: errorText,
            status: projectResponse.status 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      const projectData = await projectResponse.json();
      fortnoxProjectNumber = projectData.Project.ProjectNumber;
      console.log('Project created successfully:', fortnoxProjectNumber);
    }

    // Second PUT request to ensure project is fully activated
    const activateProjectPayload = {
      Project: {
        ProjectNumber: fortnoxProjectNumber,
        Description: `Fordon ${inventoryItem.registration_number} - ${inventoryItem.brand} ${inventoryItem.model}`,
        Status: "ONGOING",
        StartDate: new Date().toISOString().split('T')[0],
      }
    };

    console.log('Activating project with PUT request...');
    
    const activateResponse = await fetch(`https://api.fortnox.se/3/projects/${fortnoxProjectNumber}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activateProjectPayload),
    });

    if (!activateResponse.ok) {
      const errorText = await activateResponse.text();
      console.error('Failed to activate project:', errorText);
    } else {
      console.log('Project activated successfully');
    }

    // Update inventory item with Fortnox project number
    await supabase
      .from('inventory_items')
      .update({ fortnox_project_number: fortnoxProjectNumber })
      .eq('id', inventoryItemId);

    // Get account mappings for the organization
    const { data: accountMappings, error: accountError } = await supabase
      .from('account_mappings')
      .select('*')
      .eq('organization_id', inventoryItem.organization_id);

    if (accountError) {
      console.error('Error fetching account mappings:', accountError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch account mappings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Find the required accounts for MOMSI (EU Import)
    const momsiInventoryAccount = accountMappings?.find(mapping => 
      mapping.account_name === 'Lager - Momsbilar - EU'
    )?.account_number || '1412';
    
    const supplierDebtAccount = accountMappings?.find(mapping => 
      mapping.account_name === 'Leverantörsskulder'
    )?.account_number || '2440';
    
    const advancePaymentAccount = accountMappings?.find(mapping => 
      mapping.account_name === 'Förskottsbetalning'
    )?.account_number || '1680';

    const euImportAccount = accountMappings?.find(mapping => 
      mapping.account_name === 'Inköp av varor från EU'
    )?.account_number || '4515';
    
    const euImportCounterAccount = accountMappings?.find(mapping => 
      mapping.account_name === 'Motkonto inköp av varor från EU'
    )?.account_number || '4519';

    console.log('Using accounts for MOMSI:', {
      momsiInventoryAccount,
      supplierDebtAccount,
      advancePaymentAccount,
      euImportAccount,
      euImportCounterAccount
    });

    // Create supplier invoice
    const supplierInvoiceRows = [];
    
    // Add main purchase row with MOMSI account (1412)
    const mainPurchaseAmount = inventoryItem.down_payment > 0 
      ? inventoryItem.purchase_price - inventoryItem.down_payment
      : inventoryItem.purchase_price;
    
    if (mainPurchaseAmount > 0) {
      supplierInvoiceRows.push({
        Account: momsiInventoryAccount,
        Debit: mainPurchaseAmount,
        Credit: 0,
        Project: fortnoxProjectNumber,
        Description: `Inköp EU ${inventoryItem.registration_number} - ${inventoryItem.brand} ${inventoryItem.model}`,
      });

      // Add EU import VAT entries
      supplierInvoiceRows.push({
        Account: euImportAccount,
        Debit: mainPurchaseAmount,
        Credit: 0,
        Project: fortnoxProjectNumber,
        Description: `Inköp av varor från EU ${inventoryItem.registration_number}`,
      });

      supplierInvoiceRows.push({
        Account: euImportCounterAccount,
        Credit: mainPurchaseAmount,
        Debit: 0,
        Project: fortnoxProjectNumber,
        Description: `Motkonto inköp av varor från EU ${inventoryItem.registration_number}`,
      });
    }

    // Add down payment row if applicable
    if (inventoryItem.down_payment > 0) {
      supplierInvoiceRows.push({
        Account: advancePaymentAccount,
        Credit: inventoryItem.down_payment,
        Debit: 0,
        Project: fortnoxProjectNumber,
        Description: `Förskottsbetalning ${inventoryItem.registration_number}`,
      });
    }

    // Add supplier debt row (balancing entry)
    supplierInvoiceRows.push({
      Account: supplierDebtAccount,
      Credit: inventoryItem.purchase_price,
      Debit: 0,
      Project: fortnoxProjectNumber,
      Description: `Leverantörsskuld ${inventoryItem.registration_number}`,
    });

    const supplierInvoicePayload = {
      SupplierInvoice: {
        SupplierNumber: inventoryItem.supplier_name || "LEVERANTÖR",
        InvoiceDate: inventoryItem.purchase_date,
        DueDate: inventoryItem.purchase_date,
        InvoiceNumber: `MOMSI-${inventoryItem.registration_number}-${Date.now()}`,
        Total: inventoryItem.purchase_price,
        Project: fortnoxProjectNumber,
        SupplierInvoiceRows: supplierInvoiceRows,
      }
    };

    console.log('Creating MOMSI supplier invoice with payload:', JSON.stringify(supplierInvoicePayload, null, 2));

    const supplierInvoiceResponse = await fetch(`https://api.fortnox.se/3/supplierinvoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierInvoicePayload),
    });

    if (!supplierInvoiceResponse.ok) {
      const errorText = await supplierInvoiceResponse.text();
      console.error('Failed to create MOMSI supplier invoice:', {
        status: supplierInvoiceResponse.status,
        statusText: supplierInvoiceResponse.statusText,
        error: errorText,
        payload: supplierInvoicePayload
      });
      
      // Log error to database
      await supabase
        .from('fortnox_errors_log')
        .insert({
          message: `Failed to create MOMSI supplier invoice: ${errorText}`,
          type: 'fortnox-momsi-inkop',
          user_id: syncingUserId,
          context: {
            inventory_item_id: inventoryItemId,
            organization_id: inventoryItem.organization_id,
            status: supplierInvoiceResponse.status,
            payload: supplierInvoicePayload
          }
        });

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create MOMSI supplier invoice in Fortnox',
          details: errorText,
          status: supplierInvoiceResponse.status
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supplierInvoiceData = await supplierInvoiceResponse.json();
    const fortnoxInvoiceNumber = supplierInvoiceData.SupplierInvoice.GivenNumber;
    
    console.log('MOMSI supplier invoice created successfully:', fortnoxInvoiceNumber);

    // Update inventory item with Fortnox invoice number and sync status
    await supabase
      .from('inventory_items')
      .update({ 
        fortnox_invoice_number: fortnoxInvoiceNumber,
        fortnox_sync_status: 'synced',
        fortnox_synced_at: new Date().toISOString()
      })
      .eq('id', inventoryItemId);

    // Log successful sync
    await supabase
      .from('fortnox_sync_log')
      .insert({
        sync_type: 'MOMSI supplier invoice sync',
        sync_status: 'success',
        inventory_item_id: inventoryItemId,
        user_id: syncingUserId,
        fortnox_verification_number: fortnoxInvoiceNumber,
        sync_data: {
          fortnox_project_number: fortnoxProjectNumber,
          fortnox_invoice_number: fortnoxInvoiceNumber,
          registration_number: inventoryItem.registration_number
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'MOMSI inventory item synced successfully to Fortnox',
        fortnoxProjectNumber,
        fortnoxInvoiceNumber 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in fortnox-momsi-inkop function:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        type: error.name
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});