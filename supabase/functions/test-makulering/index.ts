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
    console.log('🧪 Test function started');
    
    const { userId = '8b3b5cbd-4320-4dce-bd70-5526a0db40de' } = await req.json().catch(() => ({}));

    console.log('🔍 Testing integration lookup for user:', userId);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Test integration lookup with better error handling
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token, refresh_token, token_expires_at, company_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    console.log('🔍 Integration query result:', {
      hasData: !!integration,
      error: integrationError,
      hasAccessToken: !!integration?.access_token,
      tokenExpiresAt: integration?.token_expires_at,
      companyName: integration?.company_name
    });

    if (integrationError || !integration) {
      console.error('❌ No active integration found:', integrationError);
      return new Response(
        JSON.stringify({ 
          error: 'No active integration found',
          details: integrationError 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test token expiry check
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
    const now = new Date();
    const isExpired = tokenExpiresAt && now >= tokenExpiresAt;

    console.log('🕐 Token status:', {
      expiresAt: tokenExpiresAt?.toISOString(),
      now: now.toISOString(),
      isExpired
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        integration: {
          hasAccessToken: !!integration.access_token,
          hasRefreshToken: !!integration.refresh_token,
          tokenExpiresAt: integration.token_expires_at,
          companyName: integration.company_name,
          isExpired
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Test function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Test function failed',
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});