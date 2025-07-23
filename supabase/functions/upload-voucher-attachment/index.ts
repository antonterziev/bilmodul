
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
    const { series, number, userId, vehicleId } = await req.json();

    console.log('📎 Uploading attachment to voucher:', { series, number, userId, vehicleId });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's Fortnox integration details
    const { data: integration, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token')
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

    // Get Fortnox credentials from environment
    const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET');
    const clientId = Deno.env.get('FORTNOX_CLIENT_ID');

    if (!clientSecret || !clientId) {
      console.error('❌ Missing Fortnox credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Missing Fortnox credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get vehicle data to find purchase documentation
    const { data: vehicle, error: vehicleError } = await supabase
      .from('inventory_items')
      .select('purchase_documentation')
      .eq('id', vehicleId)
      .single();

    if (vehicleError) {
      console.error('❌ Could not fetch vehicle data:', vehicleError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch vehicle data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!vehicle?.purchase_documentation) {
      console.log('ℹ️ No purchase documentation found for this vehicle');
      return new Response(
        JSON.stringify({ error: 'No purchase documentation found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📎 Found purchase documentation, uploading to Fortnox...');
    
    try {
      // Hämta filen från Supabase Storage
      const { data: fileData, error: fileError } = await supabase.storage
        .from('down-payment-docs')
        .download(vehicle.purchase_documentation);

      if (fileError) {
        console.error('❌ Could not download file from storage:', fileError);
        return new Response(
          JSON.stringify({ error: 'Could not download file from storage' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('📥 File downloaded from storage, uploading to Fortnox...');
      
      // Skapa FormData för att ladda upp till Fortnox
      const formData = new FormData();
      formData.append('file', fileData, 'bokforingsunderlag.pdf');
      formData.append('voucherSeries', series);
      formData.append('voucherNumber', number.toString());

      // Ladda upp bilagan till Fortnox
      const attachmentRes = await fetch('https://api.fortnox.se/3/voucherattachments', {
        method: 'POST',
        headers: {
          "Access-Token": integration.access_token,
          "Client-Secret": clientSecret,
          "Client-Identifier": clientId
          // Notera: Inte Content-Type header för FormData
        },
        body: formData
      });

      if (attachmentRes.ok) {
        const attachmentData = await attachmentRes.json();
        console.log('✅ Attachment uploaded successfully:', attachmentData);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Bokföringsunderlag uppladdat till verifikat ${series}-${number}`,
            attachmentData
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } else {
        const attachmentError = await attachmentRes.text();
        console.error('❌ Failed to upload attachment:', attachmentError);
        return new Response(
          JSON.stringify({ error: `Failed to upload attachment: ${attachmentError}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (uploadError) {
      console.error('❌ Error during file upload process:', uploadError);
      return new Response(
        JSON.stringify({ error: `Error during file upload: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Ett oväntat fel inträffade' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
