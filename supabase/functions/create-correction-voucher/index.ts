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
    const { series, number, userId } = await req.json();

    console.log('📝 Creating correction voucher for:', { series, number, userId });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's Fortnox integration details
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token, client_secret, client_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No active Fortnox integration found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Access-Token": integration.access_token,
      "Client-Secret": integration.client_secret,
      "Client-Identifier": integration.client_id
    };

    console.log('🔍 Fetching original voucher:', `https://api.fortnox.se/3/vouchers/${series}/${number}`);

    // 1. Hämta originalverifikatet
    const originalRes = await fetch(
      `https://api.fortnox.se/3/vouchers/${series}/${number}`,
      { headers }
    );

    if (!originalRes.ok) {
      const errorText = await originalRes.text();
      console.error('❌ Could not fetch original voucher:', errorText);
      return new Response(
        JSON.stringify({ error: 'Kunde inte hämta originalverifikatet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const original = await originalRes.json();
    const origVoucher = original.Voucher;

    console.log('📄 Original voucher fetched:', origVoucher);

    // 2. Bygg spegelverifikatet (swap debit and credit)
    const correctionRows = origVoucher.VoucherRows.map((row: any) => ({
      Account: row.Account,
      Debit: row.Credit,
      Credit: row.Debit
    }));

    const body = {
      VoucherSeries: series,
      TransactionDate: new Date().toISOString().split("T")[0],
      Description: `Makulerar verifikat ${series}-${number}`,
      Reference: "Ändringsverifikation",
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
      return new Response(
        JSON.stringify({ error: `Fel vid skapande: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const created = await createRes.json();
    console.log('✅ Correction voucher created:', created);

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