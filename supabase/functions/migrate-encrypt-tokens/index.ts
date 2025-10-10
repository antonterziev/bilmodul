/**
 * One-time migration function to encrypt existing Fortnox OAuth tokens
 * 
 * This function:
 * 1. Reads all fortnox_integrations records with plaintext tokens
 * 2. Encrypts them using the shared encryption utility
 * 3. Stores encrypted versions in encrypted_access_token and encrypted_refresh_token
 * 
 * After running this once, the plaintext columns can be dropped safely.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Starting token encryption migration...');

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all integrations that need encryption
    const { data: integrations, error: fetchError } = await supabase
      .from('fortnox_integrations')
      .select('id, access_token, refresh_token, encrypted_access_token, encrypted_refresh_token')
      .or('encrypted_access_token.is.null,encrypted_refresh_token.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch integrations: ${fetchError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log('✅ No integrations need encryption');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No integrations need encryption',
          encrypted: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${integrations.length} integrations to encrypt`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each integration
    for (const integration of integrations) {
      try {
        console.log(`🔐 Encrypting tokens for integration ${integration.id}...`);

        // Skip if already encrypted
        if (integration.encrypted_access_token && integration.encrypted_refresh_token) {
          console.log(`⏭️  Integration ${integration.id} already encrypted, skipping`);
          continue;
        }

        // Validate we have tokens to encrypt
        if (!integration.access_token || !integration.refresh_token) {
          console.warn(`⚠️  Integration ${integration.id} missing tokens, skipping`);
          continue;
        }

        // Encrypt the tokens
        const encryptedAccessToken = await encryptToken(integration.access_token);
        const encryptedRefreshToken = await encryptToken(integration.refresh_token);

        // Update the integration with encrypted tokens
        const { error: updateError } = await supabase
          .from('fortnox_integrations')
          .update({
            encrypted_access_token: encryptedAccessToken,
            encrypted_refresh_token: encryptedRefreshToken,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        console.log(`✅ Successfully encrypted integration ${integration.id}`);
        successCount++;

      } catch (integrationError) {
        console.error(`❌ Failed to encrypt integration ${integration.id}:`, integrationError);
        errorCount++;
        errors.push({
          id: integration.id,
          error: integrationError instanceof Error ? integrationError.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Migration complete: ${successCount} succeeded, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Encrypted ${successCount} integrations`,
        total: integrations.length,
        encrypted: successCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
