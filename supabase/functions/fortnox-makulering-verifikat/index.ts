
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

    // Get user's Fortnox integration details
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No active Fortnox integration found:', integrationError);
      console.log('🔍 Integration query details:', { userId, integrationError, integration });
      return new Response(
        JSON.stringify({ error: 'No active Fortnox integration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Integration found:', { 
      hasAccessToken: !!integration.access_token,
      hasRefreshToken: !!integration.refresh_token,
      tokenExpiresAt: integration.token_expires_at 
    });

    // Get Fortnox credentials from environment
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');

    console.log("🔐 DEBUG env", {
      clientId: clientId ? "OK" : "MISSING",
      clientSecret: clientSecret ? "OK" : "MISSING",
      token: integration.access_token ? "OK" : "MISSING"
    });

    console.log("🧪 Access token (truncated):", integration.access_token?.slice(0, 10));
    console.log("🕐 Token expires at:", integration.token_expires_at);

    if (!clientSecret || !clientId) {
      console.error('❌ Missing Fortnox credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Missing Fortnox credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and try to refresh
    let currentAccessToken = integration.access_token;
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
    const now = new Date();
    
    if (tokenExpiresAt && now >= tokenExpiresAt) {
      console.log('🔄 Access token expired, attempting refresh...');
      
      if (!integration.refresh_token) {
        console.error('❌ No refresh token available');
        // Delete expired integration
        await supabase
          .from('fortnox_integrations')
          .update({ is_active: false })
          .eq('user_id', userId);
          
        return new Response(
          JSON.stringify({ 
            error: 'Fortnox-anslutningen har gått ut. Anslut igen via Inställningar → Integrationer.',
            requiresReconnection: true 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to refresh token
      const refreshRes = await fetch('https://api.fortnox.se/3/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Client-Secret': clientSecret,
          'Client-Identifier': clientId
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token
        })
      });

      if (refreshRes.ok) {
        const tokenData = await refreshRes.json();
        currentAccessToken = tokenData.access_token;
        
        // Update token in database
        const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
        await supabase
          .from('fortnox_integrations')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || integration.refresh_token,
            token_expires_at: newExpiresAt.toISOString()
          })
          .eq('user_id', userId);
          
        console.log('✅ Token refreshed successfully');
      } else {
        console.error('❌ Failed to refresh token');
        // Deactivate integration
        await supabase
          .from('fortnox_integrations')
          .update({ is_active: false })
          .eq('user_id', userId);
          
        return new Response(
          JSON.stringify({ 
            error: 'Fortnox-anslutningen kunde inte förnyas. Anslut igen via Inställningar → Integrationer.',
            requiresReconnection: true 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Debug log all header values
    console.log('🔍 Header values:', {
      access_token: currentAccessToken ? 'PRESENT' : 'MISSING',
      client_secret: clientSecret ? 'PRESENT' : 'MISSING',
      client_id: clientId ? 'PRESENT' : 'MISSING'
    });

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Access-Token": currentAccessToken,
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
