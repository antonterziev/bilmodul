import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log('Fortnox OAuth request:', { method: req.method, url: url.toString() });

  const clientId = Deno.env.get('FORTNOX_CLIENT_ID');
  const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
  const redirectUri = 'https://yztwwehxppldoecwhomg.supabase.co/functions/v1/fortnox-oauth';
  
  // Determine app callback URL based on environment
  const isProduction = supabaseUrl?.includes('yztwwehxppldoecwhomg.supabase.co');
  const appCallbackUrl = isProduction
    ? 'https://bilmodul.se/fortnox-callback'
    : 'https://ef9da7a5-43fb-4d9c-92e6-459d7d3317e9.lovableproject.com/fortnox-callback';
  
  console.log('Using PRODUCTION endpoint and redirect URI:', redirectUri);
  console.log('App callback URL:', appCallbackUrl);

  if (!clientId || !clientSecret) {
    console.error('Missing Fortnox credentials');
    if (req.method === 'GET') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=error&message=${encodeURIComponent('Server configuration error')}`
        }
      });
    }
    return new Response(JSON.stringify({ error: 'Missing server credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle GET request (OAuth callback from Fortnox)
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('GET callback parameters:', {
      code: code ? `${code.substring(0, 8)}...` : 'MISSING',
      state: state ? `${state.substring(0, 8)}...` : 'MISSING',
      error,
      errorDescription
    });

    // Handle error from Fortnox
    if (error) {
      console.error('Fortnox OAuth error:', { error, errorDescription });
      const errorMessage = encodeURIComponent(`Fel vid anslutning: ${errorDescription || error}`);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
        }
      });
    }

    if (!code || !state) {
      console.error('Missing code or state in OAuth callback');
      const errorMessage = encodeURIComponent('Felaktig återkallnings-URL. Saknar auktoriseringskod.');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
        }
      });
    }

    const requestId = crypto.randomUUID();
    console.log(`🔁 Callback received ${requestId}:`, {
      code: code?.substring(0, 8) + '...',
      state: state?.substring(0, 8) + '...'
    });

    // CRITICAL: Check if this authorization code has already been used
    const { data: existingCode } = await supabase
      .from('fortnox_integrations')
      .select('id, oauth_code, code_used_at')
      .eq('oauth_code', code)
      .not('code_used_at', 'is', null)
      .maybeSingle();

    if (existingCode) {
      console.error(`🚫 Authorization code reuse detected for ${requestId}:`, {
        previousUse: existingCode.code_used_at,
        integrationId: existingCode.id
      });
      const errorMessage = encodeURIComponent('Denna auktoriseringskod har redan använts. Starta om anslutningsprocessen.');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
        }
      });
    }

    try {
      // Cleanup old states first
      await supabase.rpc('cleanup_old_oauth_states');

      // Verify state using dedicated OAuth states table
      const { data: validState, error: stateError } = await supabase
        .from('fortnox_oauth_states')
        .select('user_id, created_at, used_at')
        .eq('state', state)
        .maybeSingle();

      if (stateError) {
        console.error(`State lookup failed for request ${requestId}:`, stateError);
        const errorMessage = encodeURIComponent('Fel vid validering av auktoriserings-session. Försök igen.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      if (!validState) {
        console.error(`Invalid state for request ${requestId}: state not found`);
        const errorMessage = encodeURIComponent('Ogiltig auktoriserings-session. Starta om anslutningsprocessen.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      if (validState.used_at) {
        console.error(`State reuse attempt detected for request ${requestId}: state already used at ${validState.used_at}`);
        const errorMessage = encodeURIComponent('Denna auktoriserings-session har redan använts. Starta om anslutningsprocessen.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      // Check if state is too old (more than 10 minutes)
      const stateAge = Date.now() - new Date(validState.created_at).getTime();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (stateAge > maxAge) {
        console.error(`State expired for request ${requestId}. Age: ${Math.round(stateAge / 60000)} minutes`);
        const errorMessage = encodeURIComponent('Auktoriserings-sessionen har gått ut. Försök ansluta igen från början.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      console.log(`✅ State validated for user ${validState.user_id} in request ${requestId}`);

      // Mark the state as used immediately to prevent race conditions
      const { error: markStateUsedError } = await supabase
        .from('fortnox_oauth_states')
        .update({ used_at: new Date().toISOString() })
        .eq('state', state);

      if (markStateUsedError) {
        console.error(`Failed to mark state as used for request ${requestId}:`, markStateUsedError);
      } else {
        console.log(`✅ State marked as used for request ${requestId}`);
      }

      // Prepare token exchange request - USING PRODUCTION ENDPOINT
      // Create Basic Auth credentials as per Fortnox documentation
      const credentials = btoa(`${clientId}:${clientSecret}`);
      
      const tokenPayload = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      };

      console.log(`🔄 Token exchange request for ${requestId}:`, {
        grant_type: tokenPayload.grant_type,
        code: tokenPayload.code ? `${tokenPayload.code.substring(0, 8)}...` : 'MISSING',
        redirect_uri: tokenPayload.redirect_uri,
        client_id: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
        client_secret: clientSecret ? 'PROVIDED' : 'MISSING',
        timestamp: new Date().toISOString(),
        codeLength: code?.length || 0
      });

      // Add delay to prevent timing issues
      console.log(`⏱️ Adding 500ms delay before token exchange for ${requestId}`);
      await new Promise(resolve => setTimeout(resolve, 500));

      const tokenResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams(tokenPayload)
      });

      const tokenData = await tokenResponse.json();

      console.log(`Fortnox token response for ${requestId}:`, {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        error: tokenData.error,
        errorDescription: tokenData.error_description
      });

      if (!tokenResponse.ok) {
        console.error(`Token exchange failed for ${requestId}:`, tokenData);
        
        // Provide specific error messages based on Fortnox error codes
        let userFriendlyMessage = 'Kunde inte ansluta till Fortnox.';
        
        if (tokenData.error === 'invalid_grant') {
          userFriendlyMessage = 'Auktoriseringskoden är ogiltig eller har redan använts. Kontrollera att redirect URI i Fortnox-appen är korrekt inställd.';
        } else if (tokenData.error === 'invalid_client') {
          userFriendlyMessage = 'Felaktig klient-konfiguration. Kontrollera att Client ID och Client Secret är korrekta.';
        } else if (tokenData.error === 'invalid_request') {
          userFriendlyMessage = 'Felaktig förfrågan till Fortnox. Försök igen.';
        }
        
        const errorMessage = encodeURIComponent(userFriendlyMessage);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      // Store tokens in fortnox_integrations table (upsert for user)
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      console.log(`📊 Fetching company information for ${requestId}...`);
      
      // Fetch company information to get the company ID
      let companyId = null;
      let companyName = null;
      
      try {
        const companyResponse = await fetch('https://api.fortnox.se/3/companyinformation', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          console.log(`📊 Company information received for ${requestId}:`, companyData);
          
          if (companyData.CompanyInformation) {
            // Use OrganizationNumber instead of DatabaseNumber for validation
            const fortnoxOrgNumber = companyData.CompanyInformation.OrganizationNumber;
            companyId = fortnoxOrgNumber?.toString();
            companyName = companyData.CompanyInformation.CompanyName;
            console.log(`📊 Extracted company org number: ${companyId}, name: ${companyName}`);
            console.log(`📊 Full company data:`, JSON.stringify(companyData.CompanyInformation, null, 2));
          }
        } else {
          console.warn(`⚠️ Failed to fetch company information for ${requestId}:`, companyResponse.status);
          const responseText = await companyResponse.text();
          console.warn(`⚠️ Response body:`, responseText);
        }
      } catch (companyError) {
        console.error(`❌ Error fetching company information for ${requestId}:`, companyError);
      }
      
      // Get user's organization_id and organization_number from profile using service role to bypass RLS
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          organization_id,
          organizations!inner(organization_number, name)
        `)
        .eq('user_id', validState.user_id)
        .single();

      if (profileError) {
        console.error(`Error fetching user profile for ${requestId}:`, profileError);
        const errorMessage = encodeURIComponent('Kunde inte hitta användarorganisation. Kontakta support.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      if (!userProfile?.organization_id || !userProfile?.organizations?.organization_number) {
        console.error(`User profile missing organization data for ${requestId}:`, userProfile);
        const errorMessage = encodeURIComponent('Användarorganisation eller organisationsnummer saknas. Kontakta support.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      const userOrgNumber = userProfile.organizations.organization_number;
      const userOrgName = userProfile.organizations.name;
      
      console.log(`✅ Found organization for user ${validState.user_id}:`, {
        org_id: userProfile.organization_id,
        org_number: userOrgNumber,
        org_name: userOrgName,
        fortnox_company_id: companyId
      });

      // Helper function to normalize organization numbers for comparison
      const normalizeOrgNumber = (orgNumber: string): string => {
        return orgNumber?.replace(/[-\s]/g, '') || '';
      };

      // CRITICAL: Validate that the Fortnox organization number matches the user's organization number
      if (companyId) {
        const normalizedFortnoxOrgNumber = normalizeOrgNumber(companyId);
        const normalizedUserOrgNumber = normalizeOrgNumber(userOrgNumber);
        
        if (normalizedFortnoxOrgNumber !== normalizedUserOrgNumber) {
          console.error(`🚫 Organization mismatch for ${requestId}:`, {
            user_org_number: userOrgNumber,
            user_org_number_normalized: normalizedUserOrgNumber,
            fortnox_org_number: companyId,
            fortnox_org_number_normalized: normalizedFortnoxOrgNumber,
            user_org_name: userOrgName,
            fortnox_company_name: companyName
          });
          
          const errorMessage = encodeURIComponent(
            `Du kan endast ansluta till din egen organisation (${userOrgNumber}). ` +
            `Det Fortnox-företag du försökte ansluta till har organisationsnummer ${companyId}.`
          );
          
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
            }
          });
        } else {
          console.log(`✅ Organization validation passed for ${requestId}:`, {
            user_org_number: userOrgNumber,
            fortnox_org_number: companyId,
            normalized_match: `${normalizedUserOrgNumber} === ${normalizedFortnoxOrgNumber}`
          });
        }
      } else {
        console.warn(`⚠️ No organization number received from Fortnox for ${requestId}. Proceeding without validation.`);
      }

      // Deactivate previous integrations for user
      await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('user_id', validState.user_id);

      console.log(`🔐 Encrypting tokens for request ${requestId}...`);
      
      // Encrypt tokens before storing
      const encryptedAccessToken = await encryptToken(tokenData.access_token);
      const encryptedRefreshToken = await encryptToken(tokenData.refresh_token);
      
      console.log(`✅ Tokens encrypted for request ${requestId}`);

      const { error: insertError } = await supabase
        .from('fortnox_integrations')
        .insert({
          user_id: validState.user_id,
          organization_id: userProfile.organization_id,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt.toISOString(),
          oauth_code: code,
          code_used_at: new Date().toISOString(),
          is_active: true,
          fortnox_company_id: companyId,
          company_name: companyName,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`Error storing tokens for ${requestId}:`, insertError);
        const errorMessage = encodeURIComponent('Kunde inte spara anslutningsuppgifter. Försök igen.');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
          }
        });
      }

      // Clean up the used state after successful token exchange
      await supabase
        .from('fortnox_oauth_states')
        .delete()
        .eq('state', state);

      console.log(`✅ OAuth state cleaned up for request ${requestId}`);

      console.log(`Fortnox integration successful for user ${validState.user_id}, request ${requestId}`);

      // Redirect to success page
      const successMessage = encodeURIComponent('Fortnox-anslutning lyckad!');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=success&message=${successMessage}`
        }
      });

    } catch (fetchError) {
      console.error(`Network error during token exchange for ${requestId}:`, fetchError);
      const errorMessage = encodeURIComponent('Nätverksfel vid anslutning till Fortnox. Kontrollera din internetanslutning och försök igen.');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appCallbackUrl}?status=error&message=${errorMessage}`
        }
      });
    }
  }

  // Handle POST requests (API calls from frontend)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid request method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { action, user_id } = payload;

  // ENV CHECK: Log environment and credentials for debugging
  console.log('ENV CHECK:', {
    environment: 'production',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
    clientSecret: clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING',
    redirectUri,
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    isProduction: true,
    isSandbox: false
  });

  if (action === 'get_auth_url') {
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cleanup old states first
    await supabase.rpc('cleanup_old_oauth_states');

    const state = crypto.randomUUID();
    
    // Store state in dedicated OAuth states table for CSRF protection
    const { error: stateError } = await supabase
      .from('fortnox_oauth_states')
      .insert({
        state,
        user_id
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      return new Response(JSON.stringify({ error: 'Failed to initialize OAuth' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const scope = 'companyinformation bookkeeping archive inbox connectfile costcenter warehouse project supplier article customer supplierinvoice';
    // USING PRODUCTION ENDPOINT FOR AUTH URL
    const authUrl = `https://apps.fortnox.se/oauth-v1/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}&` +
      `response_type=code&` +
      `access_type=offline`;

    console.log('Generated Fortnox auth URL for user:', user_id);
    console.log('Using PRODUCTION endpoint and redirect URI:', redirectUri);
    console.log('State generated:', state);

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
