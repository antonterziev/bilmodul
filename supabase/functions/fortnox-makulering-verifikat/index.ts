
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { series, number, userId, correctionSeries = 'A', correctionDate } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integration, error } = await supabase
      .from('fortnox_integrations')
      .select('access_token, refresh_token, token_expires_at, fortnox_company_id, company_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !integration) {
      return new Response(JSON.stringify({ error: 'Ingen aktiv Fortnox-integration' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');

    if (!clientSecret || !clientId) {
      return new Response(JSON.stringify({ error: 'Saknar Fortnox client credentials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for expiration
    const now = Date.now();
    const tokenExpiry = new Date(integration.token_expires_at).getTime();
    let accessToken = integration.access_token;

    if (now >= tokenExpiry) {
      console.log("🔄 Token expired – refreshing");

      const refreshRes = await fetch("https://apps.fortnox.se/oauth-v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret
        }),
      });

      const refreshed = await refreshRes.json();

      if (!refreshRes.ok) {
        console.error("❌ Refresh failed", refreshed);
        return new Response(JSON.stringify({ error: 'Token refresh misslyckades', details: refreshed }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      accessToken = refreshed.access_token;

      await supabase
        .from('fortnox_integrations')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      console.log("✅ Token refreshed");
    }

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Client-Identifier": clientId,
    };

    const originalRes = await fetch(
      `https://api.fortnox.se/3/vouchers/${series}/${number}`,
      { headers }
    );

    if (!originalRes.ok) {
      const err = await originalRes.text();
      return new Response(JSON.stringify({ error: 'Kunde inte hämta original', details: err }), {
        status: originalRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { Voucher: origVoucher } = await originalRes.json();
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

    const transactionDate = correctionDate || origVoucher.TransactionDate || new Date().toISOString().split("T")[0];

    const payload = {
      VoucherSeries: correctionSeries,
      TransactionDate: transactionDate,
      Description: `Ändringsverifikation för verifikat ${series}-${number}`,
      Reference: "Automatisk makulering",
      VoucherRows: correctionRows
    };

    const createRes = await fetch("https://api.fortnox.se/3/vouchers", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      return new Response(JSON.stringify({ error: 'Fel vid skapande', details: errorText }), {
        status: createRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const created = await createRes.json();

    await supabase.from('fortnox_corrections').insert({
      user_id: userId,
      original_series: series,
      original_number: number,
      correction_series: created.Voucher.VoucherSeries,
      correction_number: created.Voucher.VoucherNumber,
      correction_date: transactionDate
    });

    return new Response(JSON.stringify({
      success: true,
      correctionVoucher: created.Voucher,
      message: `Ändringsverifikation ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapad`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Internal error:", err);
    return new Response(JSON.stringify({ error: 'Interna fel', details: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
