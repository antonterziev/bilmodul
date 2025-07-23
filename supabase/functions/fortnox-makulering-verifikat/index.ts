
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { series, number, userId, correctionSeries = 'A', correctionDate } = await req.json();
    const integration = await getActiveIntegration(userId);

    if (!integration) {
      return errorResponse('No active Fortnox integration found', 404);
    }

    let headers = getHeaders(integration.access_token);

    let originalVoucher = await tryFetchVoucher(headers, series, number);

    if (originalVoucher.error === 'token') {
      const refreshOk = await refreshAccessToken(userId);
      if (!refreshOk) return errorResponse('Autentisering misslyckades. Kontrollera din Fortnox-anslutning i inställningar.', 401);

      const refreshedIntegration = await getActiveIntegration(userId);
      if (!refreshedIntegration) return errorResponse('Token refresh lyckades men ingen integration hittades.', 404);

      headers = getHeaders(refreshedIntegration.access_token);
      originalVoucher = await tryFetchVoucher(headers, series, number);
      if (originalVoucher.error) return errorResponse('Misslyckades att hämta verifikatet även efter token refresh.', 401);
    }

    const orig = originalVoucher.voucher;
    const correctionRows = orig.VoucherRows.filter(row => Number(row.Debit || 0) !== 0 || Number(row.Credit || 0) !== 0).map(row => ({
      Account: row.Account,
      Debit: row.Credit || undefined,
      Credit: row.Debit || undefined,
      CostCenter: row.CostCenter,
      Project: row.Project,
      TransactionInformation: `Makulerar rad från ${series}-${number}`
    }));

    if (correctionRows.length === 0) return errorResponse('Inga giltiga rader att makulera', 400);

    const body = {
      VoucherSeries: correctionSeries,
      TransactionDate: correctionDate || orig.TransactionDate || new Date().toISOString().split("T")[0],
      Description: `Ändringsverifikation för verifikat ${series}-${number}`,
      Reference: "Automatisk makulering",
      VoucherRows: correctionRows
    };

    const createRes = await fetch("https://api.fortnox.se/3/vouchers", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      return errorResponse(`Fel vid skapande: ${errorText}`, createRes.status);
    }

    const created = await createRes.json();
    await supabase.from('fortnox_corrections').insert({
      user_id: userId,
      original_series: series,
      original_number: number,
      correction_series: created.Voucher.VoucherSeries,
      correction_number: created.Voucher.VoucherNumber.toString(),
      correction_date: body.TransactionDate
    });

    return new Response(JSON.stringify({ success: true, correctionVoucher: created.Voucher }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (e) {
    console.error(e);
    return errorResponse('Ett oväntat fel inträffade', 500);
  }
});

async function getActiveIntegration(userId: string) {
  const { data, error } = await supabase.from('fortnox_integrations')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data || null;
}

function getHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Client-Identifier': Deno.env.get('FORTNOX_CLIENT_ID') ?? ''
  };
}

async function tryFetchVoucher(headers: Record<string, string>, series: string, number: string) {
  const res = await fetch(`https://api.fortnox.se/3/vouchers/${series}/${number}`, { headers });
  if (res.ok) return { voucher: (await res.json()).Voucher };

  const text = await res.text();
  const isTokenIssue = res.status === 401 || text.includes("access-token") || text.includes("Kan inte logga in");
  return isTokenIssue ? { error: 'token' } : { error: 'fail' };
}

async function refreshAccessToken(userId: string) {
  const integration = await getActiveIntegration(userId);
  if (!integration?.refresh_token) return false;

  const credentials = btoa(`${Deno.env.get("FORTNOX_CLIENT_ID")}:${Deno.env.get("FORTNOX_CLIENT_SECRET")}`);
  const payload = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token
  });

  const res = await fetch('https://apps.fortnox.se/oauth-v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    },
    body: payload
  });

  const token = await res.json();
  if (!res.ok || !token.access_token) return false;

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await supabase.from('fortnox_integrations').update({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }).eq('user_id', userId).eq('is_active', true);

  return true;
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
