
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
    
    // Log the incoming request
    console.log(`🔄 Starting correction for voucher ${series}-${number} for user ${userId}`);
    
    const integration = await getActiveIntegration(userId);
    if (!integration) {
      await logError(userId, 'No active Fortnox integration found');
      return errorResponse('No active Fortnox integration found', 404);
    }

    let headers = getHeaders(integration.access_token);
    let originalVoucher = await tryFetchVoucher(headers, series, number);

    if (originalVoucher.error === 'token') {
      console.log(`🔄 Token expired, refreshing for user ${userId}`);
      const refreshOk = await refreshAccessToken(userId);
      if (!refreshOk) {
        await logError(userId, 'Token refresh failed');
        return errorResponse('Autentisering misslyckades. Kontrollera din Fortnox-anslutning i inställningar.', 401);
      }

      const refreshedIntegration = await getActiveIntegration(userId);
      if (!refreshedIntegration) {
        await logError(userId, 'No integration found after token refresh');
        return errorResponse('Token refresh lyckades men ingen integration hittades.', 404);
      }

      headers = getHeaders(refreshedIntegration.access_token);
      originalVoucher = await tryFetchVoucher(headers, series, number);
      if (originalVoucher.error) {
        await logError(userId, `Failed to fetch voucher after token refresh: ${originalVoucher.error}`);
        return errorResponse('Misslyckades att hämta verifikatet även efter token refresh.', 401);
      }
    }

    if (originalVoucher.error === 'fail') {
      await logError(userId, `Failed to fetch voucher ${series}-${number}`);
      return errorResponse(`Kunde inte hämta verifikat ${series}-${number}. Kontrollera att det existerar i Fortnox.`, 404);
    }

    const orig = originalVoucher.voucher;
    console.log(`📋 Original voucher has ${orig.VoucherRows?.length || 0} rows`);

    if (!orig.VoucherRows || orig.VoucherRows.length === 0) {
      await logError(userId, `Voucher ${series}-${number} has no rows`);
      return errorResponse('Verifikatet har inga rader att makulera', 400);
    }

    const correctionRows = orig.VoucherRows
      .filter((row) => Number(row.Debit || 0) !== 0 || Number(row.Credit || 0) !== 0)
      .map((row) => {
        const cleaned: Record<string, any> = {
          Account: row.Account,
          Debit: row.Credit || undefined,
          Credit: row.Debit || undefined,
          TransactionInformation: `Makulerar rad från ${series}-${number}`
        };
        if (row.CostCenter && row.CostCenter.trim() !== '') cleaned.CostCenter = row.CostCenter;
        if (row.Project && row.Project.trim() !== '') cleaned.Project = row.Project;
        return cleaned;
      });

    if (correctionRows.length === 0) {
      await logError(userId, `No valid rows to correct in voucher ${series}-${number}`);
      return errorResponse('Inga giltiga rader att makulera (alla rader har 0 i debet och kredit)', 400);
    }

    const body = {
      VoucherSeries: correctionSeries,
      TransactionDate: correctionDate || orig.TransactionDate || new Date().toISOString().split("T")[0],
      Description: `Ändringsverifikation för verifikat ${series}-${number}`,
      Reference: "Automatisk makulering",
      VoucherRows: correctionRows
    };

    console.log(`📤 Creating correction voucher with ${correctionRows.length} rows for series ${correctionSeries}`);
    console.log(`📅 Transaction date: ${body.TransactionDate}`);
    console.log(`🔍 Request body:`, JSON.stringify(body, null, 2));

    const createRes = await fetch("https://api.fortnox.se/3/vouchers", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const responseText = await createRes.text();
    
    if (!createRes.ok) {
      console.error(`❌ Fortnox API error (${createRes.status}):`, responseText);
      
      // Parse error details if possible
      let errorDetails = responseText;
      try {
        const errorObj = JSON.parse(responseText);
        if (errorObj.ErrorInformation) {
          errorDetails = errorObj.ErrorInformation.message || errorObj.ErrorInformation.error || responseText;
        }
      } catch (parseError) {
        // Keep original text if parsing fails
      }

      await logError(userId, 'Fortnox API error during correction creation', {
        status: createRes.status,
        response: responseText,
        requestBody: body,
        originalVoucher: { series, number }
      });

      return errorResponse(`Fortnox fel (${createRes.status}): ${errorDetails}`, createRes.status);
    }

    let created;
    try {
      created = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse Fortnox response:', responseText);
      await logError(userId, 'Failed to parse Fortnox response', { response: responseText });
      return errorResponse('Kunde inte tolka svaret från Fortnox', 500);
    }

    console.log(`✅ Correction voucher created: ${created.Voucher?.VoucherSeries}-${created.Voucher?.VoucherNumber}`);

    await supabase.from('fortnox_corrections').insert({
      user_id: userId,
      original_series: series,
      original_number: number,
      correction_series: created.Voucher.VoucherSeries,
      correction_number: created.Voucher.VoucherNumber.toString(),
      correction_date: body.TransactionDate
    });

    return new Response(JSON.stringify({ 
      success: true, 
      correctionVoucher: created.Voucher,
      message: `Ändringsverifikat ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapat`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (e) {
    console.error('❌ Unexpected error in fortnox-makulering-verifikat:', e);
    await logError(userId || 'unknown', 'Unexpected error', { error: e.message, stack: e.stack });
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
  if (!integration?.refresh_token) {
    await logRefreshError(userId, 'Missing refresh token');
    return false;
  }

  const clientId = Deno.env.get("FORTNOX_CLIENT_ID");
  const clientSecret = Deno.env.get("FORTNOX_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    await logRefreshError(userId, 'Missing client credentials in environment');
    return false;
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
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

  const text = await res.text();
  let token;
  try {
    token = JSON.parse(text);
  } catch {
    token = {};
  }

  if (!res.ok || !token.access_token) {
    await logRefreshError(userId, 'Fortnox refresh failed', {
      status: res.status,
      response: text,
      refresh_token: integration.refresh_token,
      clientIdSet: !!clientId,
      clientSecretSet: !!clientSecret
    });
    return false;
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await supabase.from('fortnox_integrations').update({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }).eq('user_id', userId).eq('is_active', true);

  return true;
}

async function logError(userId: string, message: string, context = {}) {
  try {
    await supabase.from('fortnox_errors_log').insert({
      user_id: userId,
      type: 'correction_error',
      message,
      context: JSON.stringify(context),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Failed to log Fortnox error:', e);
  }
}

async function logRefreshError(userId: string, message: string, context = {}) {
  try {
    await supabase.from('fortnox_errors_log').insert({
      user_id: userId,
      type: 'refresh_token_error',
      message,
      context: JSON.stringify(context),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Failed to log Fortnox refresh error:', e);
  }
}

async function deactivateBrokenIntegration(userId: string, reason = 'unknown') {
  console.warn(`🛑 Inaktiverar trasig Fortnox-integration för ${userId}. Orsak: ${reason}`);
  const { error } = await supabase
    .from('fortnox_integrations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('❌ Kunde inte inaktivera trasig integration:', error);
  }
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
