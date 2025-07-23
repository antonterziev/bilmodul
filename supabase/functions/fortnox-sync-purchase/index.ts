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

    // Optional: Upload file if it exists using new attachment method
    let attachmentResult = null;
    if (inventoryItem.purchase_documentation) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const filePath = inventoryItem.purchase_documentation.replace('purchase-docs/', '');
      const { data: fileData, error: fileError } = await serviceClient.storage.from('purchase-docs').download(filePath);
      if (!fileError && fileData) {
        const formData = new FormData();
        formData.append('file', new File([fileData], 'bokforingsunderlag.pdf', { type: 'application/pdf' }));
        formData.append('inventoryItemId', inventoryItemId);

        const uploadResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-verification-attachment`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!
          },
          body: formData
        });

        const uploadData = await uploadResponse.json();
        
        if (uploadResponse.ok && uploadData?.success) {
          attachmentResult = { success: true, fileId: uploadData.fileId };
        } else {
          attachmentResult = { success: false, error: uploadData?.error || 'Upload failed' };
        }
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