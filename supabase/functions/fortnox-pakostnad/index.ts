import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get Fortnox API docs
async function getFortnoxApiDocs(endpoint?: string, method?: string): Promise<any | null> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data } = await supabase.functions.invoke('fortnox-docs', {
      body: { endpoint, method }
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching Fortnox API docs:', error);
    return null;
  }
}

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

    const body = await req.json();
    const { pakostnadId, syncingUserId } = body;

    console.log('Processing påkostnad:', { pakostnadId, syncingUserId });

    if (!pakostnadId) {
      return new Response(
        JSON.stringify({ error: 'pakostnadId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get påkostnad details
    const { data: pakostnad, error: pakostnadError } = await supabase
      .from('pakostnader')
      .select(`
        *,
        inventory_items!inner(
          registration_number,
          organization_id
        )
      `)
      .eq('id', pakostnadId)
      .single();

    if (pakostnadError || !pakostnad) {
      console.error('Error fetching påkostnad:', pakostnadError);
      return new Response(
        JSON.stringify({ 
          error: 'Påkostnad not found', 
          details: pakostnadError?.message || 'No data returned',
          pakostnadId 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Påkostnad data:', pakostnad);

    // Get syncing user's profile
    const { data: syncingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', syncingUserId)
      .single();

    if (profileError || !syncingProfile) {
      console.error('Error fetching syncing user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Syncing user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organization consistency
    if (pakostnad.inventory_items.organization_id !== syncingProfile.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Organization mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look for ANY active Fortnox integration within the same organization
    console.log(`🔍 Looking for Fortnox integration for organization: ${syncingProfile.organization_id}`)
    
    // First, get all users in the same organization
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('organization_id', syncingProfile.organization_id);

    if (orgUsersError) {
      console.error('❌ Error fetching organization users:', orgUsersError);
      return new Response(
        JSON.stringify({ error: 'Error fetching organization users', details: orgUsersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = orgUsers.map(u => u.user_id);
    console.log(`🔍 Found ${userIds.length} users in organization`);

    // Now find any active Fortnox integration for these users
    const { data: fortnoxIntegration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (integrationError) {
      console.error('❌ Error fetching Fortnox integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Error fetching Fortnox integration', details: integrationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fortnoxIntegration) {
      console.error('❌ No active Fortnox integration found for organization');
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found for organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const integration = fortnoxIntegration;
    const FORTNOX_CLIENT_SECRET = Deno.env.get('FORTNOX_CLIENT_SECRET');
    if (!FORTNOX_CLIENT_SECRET) {
      console.error('❌ FORTNOX_CLIENT_SECRET not found');
      return new Response(
        JSON.stringify({ error: 'Fortnox client secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = integration.access_token;
    const clientSecret = FORTNOX_CLIENT_SECRET;

    // Check if token needs refresh
    const tokenExpiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    if (now.getTime() > (tokenExpiresAt.getTime() - bufferTime)) {
      console.log('🔄 Access token expired or expiring soon, refreshing...');
      
      const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: integration.fortnox_company_id || 'unknown',
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        const refreshError = await refreshResponse.text();
        console.error('Token refresh failed:', refreshError);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Fortnox token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update the integration with new tokens
      await supabase
        .from('fortnox_integrations')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('id', integration.id);

      console.log('Token refreshed successfully');
    }

    // Get account mappings for the organization
    const { data: accountMappings, error: mappingsError } = await supabase
      .from('account_mappings')
      .select('*')
      .eq('organization_id', pakostnad.inventory_items.organization_id);

    if (mappingsError) {
      console.error('Error fetching account mappings:', mappingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch account mappings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find required accounts
    const pakostnadAccount = accountMappings?.find(m => m.account_name === 'Lager - Påkostnader')?.account_number || '1414';
    const inputVatAccount = accountMappings?.find(m => m.account_name === 'Ingående moms')?.account_number || '2641';
    const supplierDebtAccount = accountMappings?.find(m => m.account_name === 'Leverantörsskulder')?.account_number || '2440';

    console.log('Using accounts:', { pakostnadAccount, inputVatAccount, supplierDebtAccount });

    // Calculate amounts
    const totalAmount = pakostnad.amount;
    const vatRate = 0.25; // 25% VAT
    const netAmount = Math.round((totalAmount / (1 + vatRate)) * 100) / 100;
    const vatAmount = Math.round((totalAmount - netAmount) * 100) / 100;

    console.log('Calculated amounts:', { totalAmount, netAmount, vatAmount });

    // Create supplier invoice in Fortnox
    const invoicePayload = {
      SupplierInvoice: {
        SupplierNumber: pakostnad.supplier || 'UNKNOWN',
        InvoiceNumber: `PAK-${pakostnad.id.slice(-8)}`,
        InvoiceDate: pakostnad.date,
        DueDate: pakostnad.date,
        OCR: null,
        Total: totalAmount,
        Project: pakostnad.inventory_items.registration_number,
        Comments: `Påkostnad för ${pakostnad.inventory_items.registration_number} - ${pakostnad.category}`,
        SupplierInvoiceRows: [
          {
            Account: pakostnadAccount,
            Debit: netAmount,
            Credit: 0,
            TransactionInformation: `Påkostnad - ${pakostnad.category}`,
            Project: pakostnad.inventory_items.registration_number
          },
          {
            Account: inputVatAccount,
            Debit: vatAmount,
            Credit: 0,
            TransactionInformation: 'Ingående moms 25%',
            Project: pakostnad.inventory_items.registration_number
          },
          {
            Account: supplierDebtAccount,
            Debit: 0,
            Credit: totalAmount,
            TransactionInformation: 'Leverantörsskuld',
            Project: pakostnad.inventory_items.registration_number
          }
        ]
      }
    };

    console.log('Creating supplier invoice with payload:', JSON.stringify(invoicePayload, null, 2));

    const invoiceResponse = await fetch('https://api.fortnox.se/3/supplierinvoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Access-Token': clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload),
    });

    console.log('Invoice response status:', invoiceResponse.status);
    const invoiceResponseText = await invoiceResponse.text();
    console.log('Invoice response:', invoiceResponseText);

    if (!invoiceResponse.ok) {
      // Log error to database
      await supabase.from('fortnox_errors_log').insert({
        message: `Failed to create påkostnad invoice: ${invoiceResponseText}`,
        type: 'pakostnad_sync_error',
        context: { pakostnadId, invoicePayload },
        user_id: syncingUserId
      });

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create påkostnad invoice in Fortnox',
          details: invoiceResponseText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoiceData = JSON.parse(invoiceResponseText);
    const fortnoxInvoiceNumber = invoiceData.SupplierInvoice?.GivenNumber;

    console.log('Created invoice with number:', fortnoxInvoiceNumber);

    // Update påkostnad with Fortnox invoice number
    const { error: updateError } = await supabase
      .from('pakostnader')
      .update({
        fortnox_invoice_number: fortnoxInvoiceNumber,
        is_synced: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', pakostnadId);

    if (updateError) {
      console.error('Error updating påkostnad:', updateError);
    }

    // Log successful sync
    await supabase.from('fortnox_sync_log').insert({
      inventory_item_id: pakostnad.inventory_item_id,
      sync_type: 'pakostnad_sync',
      sync_status: 'success',
      sync_data: { 
        pakostnadId, 
        fortnoxInvoiceNumber,
        totalAmount,
        netAmount,
        vatAmount
      },
      user_id: syncingUserId
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        fortnoxInvoiceNumber,
        message: 'Påkostnad successfully synced to Fortnox'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fortnox-pakostnad function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});