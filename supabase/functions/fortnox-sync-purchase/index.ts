// ✅ Updated Fortnox sync-purchase function to support ArchiveFileId + attachment linking
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request body validation schema
const RequestBody = z.object({
  inventoryItemId: z.string().uuid(),
});

// Standard error response with stable codes
function errorResponse(message: string, code: string, status: number = 400) {
  return new Response(
    JSON.stringify({ 
      error: message, 
      code,
      timestamp: new Date().toISOString() 
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

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

    // Validate request body
    const bodyRaw = await req.json();
    const validationResult = RequestBody.safeParse(bodyRaw);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return errorResponse(
        'Invalid request body', 
        'VALIDATION_ERROR'
      );
    }
    
    const { inventoryItemId } = validationResult.data;

    // Get inventory item and verify organization access
    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*, organization_id')
      .eq('id', inventoryItemId)
      .single();

    if (itemError || !inventoryItem) {
      return errorResponse('Inventory item not found', 'ITEM_NOT_FOUND', 404);
    }

    // Verify user's organization access
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      return errorResponse('User profile not found', 'PROFILE_NOT_FOUND', 404);
    }

    if (inventoryItem.organization_id !== userProfile.organization_id) {
      console.error('Organization access violation:', {
        itemOrgId: inventoryItem.organization_id,
        userOrgId: userProfile.organization_id,
        userId: user.id
      });
      return errorResponse('Organization access denied', 'ORG_ACCESS_DENIED', 403);
    }
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
    
    // Check if token is expired and refresh if needed
    const tokenExpiresAt = new Date(integrations[0].token_expires_at);
    const now = new Date();
    
    if (now >= tokenExpiresAt) {
      console.log('🔄 Token expired, refreshing...');
      const refreshResponse = await fetch('https://api.fortnox.se/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integrations[0].refresh_token,
          client_id: 'uNVVMz2CA4VA',
          client_secret: clientSecret,
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;
      
      // Update the token in database
      await supabaseClient.from('fortnox_integrations').update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', integrations[0].id);
      
      console.log('✅ Token refreshed successfully');
    }
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
    const voucherSeries = voucherData?.Voucher?.VoucherSeries;
    const voucherYear = voucherData?.Voucher?.VoucherYear;

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
        const originalFileName = filePath.split('/').pop() || 'dokument.pdf'; // Extract actual filename
        console.log(`📎 Found purchase documentation: ${filePath} (original name: ${originalFileName})`);

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

          // Upload to Fortnox inbox with original filename and correct MIME type
          const fileExtension = originalFileName.toLowerCase().split('.').pop();
          const mimeType = fileExtension === 'pdf' ? 'application/pdf' : 
                          fileExtension === 'jpg' || fileExtension === 'jpeg' ? 'image/jpeg' :
                          fileExtension === 'png' ? 'image/png' : 'application/octet-stream';
          
          const uploadForm = new FormData();
          uploadForm.append("file", new File([fileData], originalFileName, { type: mimeType }));

          const inboxUploadRes = await fetch("https://api.fortnox.se/3/inbox", {
            method: "POST",
            headers: {
              "Access-Token": clientSecret,
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json",
            },
            body: uploadForm,
          });

          if (inboxUploadRes.ok) {
            const inboxJson = await inboxUploadRes.json();
            console.log("📤 Inbox upload response:", JSON.stringify(inboxJson, null, 2));
            
            // Check if we have a File object (successful upload)
            const fileId = inboxJson?.File?.Id;

            if (fileId) {
              console.log(`✅ Uploaded file to inbox. FileId: ${fileId}`);

              // Connect file to voucher - use actual Fortnox values
              console.log(`🔗 Connecting file ${fileId} to voucher ${voucherSeries}-${verificationNumber}-${voucherYear}`);
              const connectionRes = await fetch("https://api.fortnox.se/3/voucherfileconnections", {
                method: "POST",
                headers: {
                  "Access-Token": clientSecret,
                  "Authorization": `Bearer ${accessToken}`,
                  "Accept": "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  VoucherFileConnection: {
                    FileId: fileId,
                    VoucherSeries: voucherSeries,
                    VoucherNumber: verificationNumber,
                    VoucherYear: voucherYear,
                  },
                }),
              });

              if (connectionRes.ok) {
                const connectionJson = await connectionRes.json();
                console.log(`✅ File successfully connected to voucher:`, connectionJson);
                attachmentResult = { success: true, fileId };
              } else {
                const connectionJson = await connectionRes.json();
                console.error("❌ Could not connect file to voucher:", connectionJson);
                attachmentResult = { success: false, error: `Voucher connection failed: ${JSON.stringify(connectionJson)}` };
              }
            } else {
              console.error("❌ No FileId in upload response:", inboxJson);
              attachmentResult = { success: false, error: 'No FileId in upload response' };
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