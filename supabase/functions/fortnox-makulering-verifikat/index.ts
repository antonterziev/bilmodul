
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { series, number, userId, correctionSeries = 'A', correctionDate } = await req.json();

    console.log('📝 Creating correction voucher for:', { series, number, userId, correctionSeries, correctionDate });
    console.log('📍 Request received at:', new Date().toISOString());

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's Fortnox integration details (latest active integration)
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token, fortnox_company_id, company_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No active Fortnox integration found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Fortnox credentials from environment
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');

    console.log("🔐 DEBUG env", {
      clientId: clientId ? "OK" : "MISSING",
      clientSecret: clientSecret ? "OK" : "MISSING",
      token: integration.access_token ? "OK" : "MISSING",
      companyId: integration.fortnox_company_id,
      companyName: integration.company_name
    });

    console.log("🧪 Full access token for debugging:", integration.access_token);

    if (!clientSecret || !clientId) {
      console.error('❌ Missing Fortnox credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Missing Fortnox credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Access-Token": integration.access_token,
      "Client-Secret": clientSecret,
      "Client-Identifier": clientId
    };

    console.log('🔍 Fetching original voucher:', `https://api.fortnox.se/3/vouchers/${series}/${number}`);

    // 1. Hämta originalverifikatet
    const originalRes = await fetch(
      `https://api.fortnox.se/3/vouchers/${series}/${number}`,
      { headers }
    );

    if (!originalRes.ok) {
      const errorText = await originalRes.text();
      console.error('❌ Could not fetch original voucher:', {
        status: originalRes.status,
        statusText: originalRes.statusText,
        error: errorText,
        headers: Object.fromEntries(originalRes.headers.entries())
      });
      
      // Check if this is a token authentication error (Fortnox token expired/invalid)
      if (originalRes.status === 401 || 
          errorText.includes("access-token eller client-secret saknas") || 
          errorText.includes("Kan inte logga in")) {
        console.log('🔄 Token authentication failed, but keeping integration active for manual retry');
        
        return new Response(
          JSON.stringify({ 
            error: 'Autentisering misslyckades. Kontrollera din Fortnox-anslutning i inställningar.',
            tokenError: true,
            details: errorText
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Kunde inte hämta originalverifikatet',
          details: errorText 
        }),
        { status: originalRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const original = await originalRes.json();
    const origVoucher = original.Voucher;

    console.log('📄 Original voucher fetched:', origVoucher);

    // 2. Bygg spegelverifikatet (swap debit and credit)
    const correctionRows = origVoucher.VoucherRows
      .filter((row: any) => Number(row.Debit || 0) !== 0 || Number(row.Credit || 0) !== 0)
      .map((row: any) => ({
        Account: row.Account,
        Debit: row.Credit || undefined,
        Credit: row.Debit || undefined,
        CostCenter: row.CostCenter,
        Project: row.Project,
        TransactionInformation: `Makulerar rad från ${series}-${number}`
      }));

    if (correctionRows.length === 0) {
      console.error('❌ No valid rows found to create correction voucher');
      return new Response(
        JSON.stringify({ error: 'Inga giltiga rader att makulera' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionDate = correctionDate || origVoucher.TransactionDate || new Date().toISOString().split("T")[0];
    
    const body = {
      VoucherSeries: correctionSeries,
      TransactionDate: transactionDate,
      Description: `Ändringsverifikation för verifikat ${series}-${number}`,
      Reference: "Automatisk makulering",
      VoucherRows: correctionRows
    };

    console.log('📝 Creating correction voucher with body:', body);

    // 3. Skicka ändringsverifikatet
    const createRes = await fetch("https://api.fortnox.se/3/vouchers", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error('❌ Error creating correction voucher:', errorText);
      
      console.log('📤 Status:', createRes.status);
      console.log('📤 Response body:', errorText);
      
      // Better error handling for closed periods
      if (createRes.status === 400 && errorText.includes("Bokföringsperioden är stängd")) {
        return new Response(
          JSON.stringify({ error: "Bokföringsperioden är stängd för valt datum. Kontrollera verifikationsserien eller datumet." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle missing voucher series
      if (createRes.status === 400 && errorText.includes("Verifikationsserien")) {
        return new Response(
          JSON.stringify({ error: "Verifikationsserien finns inte eller är stängd. Kontrollera att serien 'A' är tillgänglig i Fortnox." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Fel vid skapande: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const created = await createRes.json();
    console.log('✅ Correction voucher created:', created);

    // Log the correction in database for traceability
    try {
      await supabase
        .from('fortnox_corrections')
        .insert({
          user_id: userId,
          original_series: series,
          original_number: number,
          correction_series: created.Voucher.VoucherSeries,
          correction_number: created.Voucher.VoucherNumber.toString(),
          correction_date: transactionDate
        });
      
      console.log('✅ Correction logged in database');
    } catch (logError) {
      console.error('⚠️ Failed to log correction in database:', logError);
      // Don't fail the entire operation if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        correctionVoucher: created.Voucher,
        message: `Ändringsverifikation ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapad`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Ett oväntat fel inträffade' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
