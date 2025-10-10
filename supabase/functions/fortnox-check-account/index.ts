import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { readToken } from "../_shared/encryption.ts";

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
    console.log('🔍 Fortnox check account function called');
    
    const { accountNumber, userId } = await req.json();
    
    if (!accountNumber) {
      console.error('❌ Missing accountNumber');
      return new Response(JSON.stringify({ error: 'Missing accountNumber' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!userId) {
      console.error('❌ Missing userId');
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 Checking account ${accountNumber} for user ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's Fortnox integration
    const { data: fortnoxIntegrations, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (integrationError) {
      console.error('❌ Database error fetching integration:', integrationError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      console.error('❌ No active Fortnox integration found');
      return new Response(JSON.stringify({ error: 'No active Fortnox integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const integration = fortnoxIntegrations[0];
    
    // Decrypt token before use from encrypted column
    const accessToken = await readToken(integration.encrypted_access_token);

    if (!accessToken) {
      console.error('❌ No access token found');
      return new Response(JSON.stringify({ error: 'No access token found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    if (!clientSecret) {
      console.error('❌ Missing FORTNOX_CLIENT_SECRET');
      return new Response(JSON.stringify({ error: 'Missing client secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📞 Making request to Fortnox API for account ${accountNumber}`);
    console.log(`🔑 Using decrypted access token: ${accessToken.substring(0, 20)}...`);
    console.log(`🔑 Using client secret: ${clientSecret.substring(0, 10)}...`);
    console.log(`🔍 Token length: ${accessToken.length}`);
    console.log(`🔍 Secret length: ${clientSecret.length}`);

    // Check account in Fortnox
    const fortnoxResponse = await fetch(`https://api.fortnox.se/3/accounts/${accountNumber}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Secret': clientSecret,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    });

    console.log(`📞 Fortnox API response status: ${fortnoxResponse.status}`);

    // Get the response body for detailed error logging
    const responseBody = await fortnoxResponse.text();
    console.log(`📞 Fortnox API response body: ${responseBody}`);

    if (fortnoxResponse.status === 404) {
      console.log('📞 Account not found in Fortnox');
      return new Response(JSON.stringify({ 
        success: true, 
        accountName: "Kontonummer ej aktivt",
        exists: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!fortnoxResponse.ok) {
      console.error(`❌ Fortnox API error [${fortnoxResponse.status}]:`, responseBody);
      
      // Check if it's a token expiration error
      if (fortnoxResponse.status === 401) {
        return new Response(JSON.stringify({ 
          error: 'Token expired',
          needsReconnection: true,
          details: responseBody
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For 403, provide more specific error message
      if (fortnoxResponse.status === 403) {
        return new Response(JSON.stringify({ 
          error: 'Åtkomst nekad - kontrollera att din Fortnox-integration har rätt behörigheter för att läsa kontoplan',
          details: responseBody,
          needsReconnection: true 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        error: `Fortnox API error: ${fortnoxResponse.status}`,
        details: responseBody
      }), {
        status: fortnoxResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the successful response
    let data;
    try {
      data = JSON.parse(responseBody);
    } catch (e) {
      console.error('❌ Failed to parse Fortnox response as JSON:', responseBody);
      return new Response(JSON.stringify({ 
        error: 'Invalid response format from Fortnox API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const account = data.Account;

    console.log(`✅ Account found: ${account.Description}, Active: ${account.Active}`);

    if (account.Active) {
      return new Response(JSON.stringify({ 
        success: true,
        accountName: account.Description,
        exists: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: true,
        accountName: "Kontonummer ej aktivt",
        exists: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: unknown) {
    console.error('❌ Error in fortnox-check-account function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});