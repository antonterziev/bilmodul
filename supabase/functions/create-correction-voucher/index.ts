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

    console.log('📝 Creating correction voucher for:', { series, number, userId, vehicleId });

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

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Access-Token": integration.access_token,
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
    const newVoucherNumber = created.Voucher.VoucherNumber;
    console.log('✅ Correction voucher created:', created);

    // 4. Om vehicleId finns, kolla om det finns bokföringsunderlag att ladda upp
    let attachmentUploadResult = null;
    if (vehicleId) {
      console.log('🔍 Checking for purchase documentation for vehicle:', vehicleId);
      
      const { data: vehicle, error: vehicleError } = await supabase
        .from('inventory_items')
        .select('purchase_documentation')
        .eq('id', vehicleId)
        .single();

      if (vehicleError) {
        console.log('⚠️ Could not fetch vehicle data:', vehicleError);
      } else if (vehicle?.purchase_documentation) {
        console.log('📎 Found purchase documentation, uploading to Fortnox...');
        
        try {
          // Hämta filen från Supabase Storage
          const { data: fileData, error: fileError } = await supabase.storage
            .from('down-payment-docs')
            .download(vehicle.purchase_documentation);

          if (fileError) {
            console.log('⚠️ Could not download file from storage:', fileError);
          } else {
            console.log('📥 File downloaded from storage, uploading to Fortnox...');
            
            // Skapa FormData för att ladda upp till Fortnox
            const formData = new FormData();
            formData.append('file', fileData, 'bokforingsunderlag.pdf');
            formData.append('voucherSeries', series);
            formData.append('voucherNumber', newVoucherNumber.toString());

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
              attachmentUploadResult = { success: true, data: attachmentData };
            } else {
              const attachmentError = await attachmentRes.text();
              console.log('⚠️ Failed to upload attachment:', attachmentError);
              attachmentUploadResult = { success: false, error: attachmentError };
            }
          }
        } catch (uploadError) {
          console.log('⚠️ Error during file upload process:', uploadError);
          attachmentUploadResult = { success: false, error: uploadError.message };
        }
      } else {
        console.log('ℹ️ No purchase documentation found for this vehicle');
      }
    }

    const responseMessage = attachmentUploadResult?.success 
      ? `Ändringsverifikation ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapad med bilaga`
      : attachmentUploadResult?.error 
      ? `Ändringsverifikation ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapad (bilaga kunde inte laddas upp: ${attachmentUploadResult.error})`
      : `Ändringsverifikation ${created.Voucher.VoucherSeries}-${created.Voucher.VoucherNumber} skapad`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        correctionVoucher: created.Voucher,
        attachmentResult: attachmentUploadResult,
        message: responseMessage
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