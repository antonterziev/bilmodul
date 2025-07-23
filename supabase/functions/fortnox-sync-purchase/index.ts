// ✅ Updated Fortnox sync-purchase function to support ArchiveFileId + attachment linking
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { inventoryItemId } = await req.json();
    if (!inventoryItemId) throw new Error('Missing inventoryItemId');

    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single();

    if (itemError || !inventoryItem) throw new Error('Inventory item not found');
    if (inventoryItem.fortnox_sync_status === 'synced') {
      return new Response(JSON.stringify({ success: true, message: 'Already synced' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: integrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (integrationError || !integrations || integrations.length === 0) {
      throw new Error('No active Fortnox integration found.');
    }

    let accessToken = integrations[0].access_token;
    const clientSecret = Deno.env.get("FORTNOX_CLIENT_SECRET")!;
    const purchaseDate = new Date(inventoryItem.purchase_date).toISOString().split('T')[0];
    const verificationData = {
      VoucherSeries: 'A',
      Description: `Fordonsinköp - ${inventoryItem.brand} ${inventoryItem.model} (${inventoryItem.registration_number})`,
      TransactionDate: purchaseDate,
      VoucherRows: [
        { Account: 4000, Debit: inventoryItem.purchase_price, Description: `Inköp ${inventoryItem.brand}` },
        { Account: 1910, Credit: inventoryItem.purchase_price, Description: `Betalning ${inventoryItem.model}` }
      ]
    };

    const createVoucherRes = await fetch('https://api.fortnox.se/3/vouchers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ Voucher: verificationData })
    });

    const voucherText = await createVoucherRes.text();
    if (!createVoucherRes.ok) throw new Error(voucherText);

    const voucherData = JSON.parse(voucherText);
    const verificationNumber = voucherData?.Voucher?.VoucherNumber;

    await supabaseClient.from('inventory_items').update({
      fortnox_sync_status: 'synced',
      fortnox_verification_number: verificationNumber,
      fortnox_synced_at: new Date().toISOString()
    }).eq('id', inventoryItemId);

    // Optional: Upload file if it exists - now integrated directly
    let attachmentResult = null;
    if (inventoryItem.purchase_documentation) {
      try {
        const filePath = inventoryItem.purchase_documentation.replace('purchase-docs/', '');
        console.log(`📎 Found purchase documentation: ${filePath}`);

        // Create service client for storage access
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Download file from storage
        const { data: fileData, error: fileError } = await serviceClient.storage
          .from('purchase-docs')
          .download(filePath);

        if (!fileError && fileData) {
          console.log(`📥 File downloaded successfully, size: ${fileData.size} bytes`);

          // Upload to Fortnox inbox
          const uploadForm = new FormData();
          uploadForm.append("file", new File([fileData], 'bokforingsunderlag.pdf', { type: 'application/pdf' }));

          const inboxUploadRes = await fetch("https://api.fortnox.se/3/inbox", {
            method: "POST",
            headers: {
              "Client-Secret": clientSecret,
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json",
            },
            body: uploadForm,
          });

          if (inboxUploadRes.ok) {
            const inboxJson = await inboxUploadRes.json();
            const fileId = inboxJson?.File?.Id;

            if (fileId) {
              console.log(`✅ Uploaded file to inbox. FileId: ${fileId}`);

            // Connect file to voucher
            const connectionRes = await fetch("https://api.fortnox.se/3/voucherfileconnections", {
              method: "POST",
              headers: {
                "Client-Secret": clientSecret,
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                VoucherFileConnection: {
                  FileId: fileId,
                  VoucherSeries: "A",
                  VoucherNumber: parseInt(verificationNumber),
                  VoucherYear: new Date().getFullYear(),
                },
              }),
            });

            if (connectionRes.ok) {
              console.log(`✅ File successfully connected to voucher.`);
              attachmentResult = { success: true, fileId };
            } else {
              const connectionJson = await connectionRes.json();
              console.error("❌ Could not connect file to voucher:", connectionJson);
              attachmentResult = { success: false, error: 'Voucher connection failed' };
            }
            } else {
              console.error("❌ Upload to Fortnox failed:", inboxJson);
              attachmentResult = { success: false, error: inboxJson?.ErrorInformation?.message || 'Upload failed' };
            }
          } else {
            console.error("❌ Upload request failed:", inboxUploadRes.status);
            attachmentResult = { success: false, error: 'Upload request failed' };
          }
        } else {
          console.error("❌ Could not download file from storage", fileError);
          attachmentResult = { success: false, error: 'Could not download file from storage' };
        }
      } catch (attachmentError) {
        console.error("❌ Attachment upload error:", attachmentError);
        attachmentResult = { success: false, error: attachmentError.message };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      verificationNumber,
      attachmentResult,
      message: attachmentResult?.success
        ? 'Voucher synced with attachment'
        : 'Voucher synced' + (attachmentResult?.error ? ` (attachment error: ${attachmentResult.error})` : '')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('❌ Sync error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});