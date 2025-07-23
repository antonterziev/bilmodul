
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { inventoryItemId } = await req.json()

    if (!inventoryItemId) {
      throw new Error('Missing inventoryItemId')
    }

    console.log('Starting Fortnox sync for inventory item:', inventoryItemId)

    // Get the inventory item details
    const { data: inventoryItem, error: itemError } = await supabaseClient
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single()

    if (itemError || !inventoryItem) {
      throw new Error('Inventory item not found')
    }

    // Check if already synced
    if (inventoryItem.fortnox_sync_status === 'synced') {
      console.log('Item already synced to Fortnox')
      return new Response(
        JSON.stringify({ success: true, message: 'Already synced' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user's Fortnox integration
    const { data: fortnoxIntegrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (integrationError) {
      console.error('Error fetching Fortnox integration:', integrationError)
      throw new Error('Error fetching Fortnox integration')
    }

    if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
      console.error('No Fortnox integration found')
      throw new Error('No active Fortnox integration found. Please connect to Fortnox first.')
    }

    const fortnoxIntegration = fortnoxIntegrations[0] // Use the most recent one

    console.log('Found Fortnox integration:', {
      id: fortnoxIntegration.id,
      expires_at: fortnoxIntegration.token_expires_at,
      has_refresh_token: !!fortnoxIntegration.refresh_token
    })

    // Check if token is expired and refresh if needed
    let accessToken = fortnoxIntegration.access_token
    const tokenExpiresAt = new Date(fortnoxIntegration.token_expires_at)
    const now = new Date()
    const isTokenExpired = tokenExpiresAt <= now

    console.log('Token expiration check:', {
      expires_at: tokenExpiresAt.toISOString(),
      current_time: now.toISOString(),
      is_expired: isTokenExpired,
      minutes_until_expiry: Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60))
    })

    if (isTokenExpired) {
      console.log('Access token expired, attempting refresh...')
      
      if (!fortnoxIntegration.refresh_token) {
        console.error('No refresh token available')
        throw new Error('Access token expired and no refresh token available. Please reconnect to Fortnox.')
      }

      try {
        // Refresh the token
        const clientId = Deno.env.get('FORTNOX_CLIENT_ID')
        const clientSecret = Deno.env.get('FORTNOX_CLIENT_SECRET')
        
        if (!clientId || !clientSecret) {
          throw new Error('Missing Fortnox credentials for token refresh')
        }

        const credentials = btoa(`${clientId}:${clientSecret}`)
        
        const refreshResponse = await fetch('https://apps.fortnox.se/oauth-v1/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: fortnoxIntegration.refresh_token
          })
        })

        const refreshData = await refreshResponse.json()

        console.log('Token refresh response:', {
          status: refreshResponse.status,
          ok: refreshResponse.ok,
          has_access_token: !!refreshData.access_token,
          has_refresh_token: !!refreshData.refresh_token,
          expires_in: refreshData.expires_in,
          error: refreshData.error
        })

        if (!refreshResponse.ok) {
          console.error('Token refresh failed:', refreshData)
          throw new Error(`Token refresh failed: ${refreshData.error || 'Unknown error'}. Please reconnect to Fortnox.`)
        }

        // Update the integration with new tokens
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000))
        
        const { error: updateError } = await supabaseClient
          .from('fortnox_integrations')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || fortnoxIntegration.refresh_token, // Keep old refresh token if new one not provided
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', fortnoxIntegration.id)

        if (updateError) {
          console.error('Failed to update tokens:', updateError)
          throw new Error('Failed to save refreshed tokens')
        }

        accessToken = refreshData.access_token
        console.log('Token successfully refreshed, new expiry:', newExpiresAt.toISOString())
        
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError)
        throw new Error(`Failed to refresh access token: ${refreshError.message}`)
      }
    }

    // Ensure purchase_date is in YYYY-MM-DD format
    const purchaseDate = new Date(inventoryItem.purchase_date).toISOString().split('T')[0]

    // Prepare the verification data for Fortnox with VoucherSeries and correct accounts
    const verificationData = {
      VoucherSeries: "A",
      Description: `Fordonsinköp - ${inventoryItem.brand} ${inventoryItem.model} (${inventoryItem.registration_number})`,
      TransactionDate: purchaseDate,
      VoucherRows: [
        {
          Account: 4000, // Vehicle account
          Debit: inventoryItem.purchase_price,
          Description: `Inköp ${inventoryItem.brand} ${inventoryItem.model}`,
        },
        {
          Account: 1910, // Bank account (based on your working example)
          Credit: inventoryItem.purchase_price,
          Description: `Betalning ${inventoryItem.brand} ${inventoryItem.model}`,
        }
      ]
    }

    console.log('Creating verification in Fortnox:', verificationData)

    // Create log entry
    const { data: logEntry } = await supabaseClient
      .from('fortnox_sync_log')
      .insert({
        inventory_item_id: inventoryItemId,
        user_id: user.id,
        sync_type: 'purchase',
        sync_status: 'pending',
        sync_data: verificationData
      })
      .select()
      .single()

    try {
      // Call Fortnox API to create verification
      console.log('Making Fortnox API call with access token:', accessToken.substring(0, 8) + '...')
      
      const fortnoxResponse = await fetch('https://api.fortnox.se/3/vouchers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ Voucher: verificationData })
      })

      const responseText = await fortnoxResponse.text()
      console.log('Fortnox API response:', {
        status: fortnoxResponse.status,
        statusText: fortnoxResponse.statusText,
        ok: fortnoxResponse.ok,
        body: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
      })

      if (!fortnoxResponse.ok) {
        console.error('Fortnox API error:', responseText)
        
        // Provide more specific error messages
        let errorMessage = `Fortnox API error: ${fortnoxResponse.status}`
        
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.ErrorInformation) {
            errorMessage = `Fortnox error: ${errorData.ErrorInformation.message || errorData.ErrorInformation.error}`
          }
        } catch (parseError) {
          // Use the raw response if JSON parsing fails
          errorMessage = `Fortnox API error: ${fortnoxResponse.status} - ${responseText}`
        }
        
        throw new Error(errorMessage)
      }

      const fortnoxResult = JSON.parse(responseText)
      const verificationNumber = fortnoxResult.Voucher?.VoucherNumber

      console.log('Verification created successfully:', verificationNumber)

      // Update inventory item with sync status
      await supabaseClient
        .from('inventory_items')
        .update({
          fortnox_sync_status: 'synced',
          fortnox_verification_number: verificationNumber,
          fortnox_synced_at: new Date().toISOString()
        })
        .eq('id', inventoryItemId)

      // Update sync log
      if (logEntry) {
        await supabaseClient
          .from('fortnox_sync_log')
          .update({
            sync_status: 'success',
            fortnox_verification_number: verificationNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', logEntry.id)
      }

      // After successful voucher creation, try to upload PDF if it exists
      let attachmentResult = null;
      if (inventoryItem.purchase_documentation) {
        console.log('📎 Found purchase documentation, uploading to Fortnox archive...');
        console.log('📄 Purchase documentation path:', inventoryItem.purchase_documentation);
        
        try {
          // Create a service role client to access storage
          const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );
          
          // Download file from Supabase Storage (remove bucket prefix if present)
          let filePath = inventoryItem.purchase_documentation;
          if (filePath.startsWith('purchase-docs/')) {
            filePath = filePath.replace('purchase-docs/', '');
          }
          console.log('📥 Downloading file from purchase-docs bucket with path:', filePath);
          const { data: fileData, error: fileError } = await serviceClient.storage
            .from('purchase-docs')
            .download(filePath);

          if (fileError) {
            console.log('⚠️ Could not download file from storage:', fileError);
            console.log('⚠️ Storage error details:', JSON.stringify(fileError, null, 2));
            attachmentResult = { success: false, error: `Storage error: ${fileError.message}` };
          } else {
            console.log('✅ File downloaded successfully, size:', fileData.size, 'bytes');
            console.log('📥 File type:', fileData.type);
            
            // Convert file to bytes for upload
            const fileBytes = new Uint8Array(await fileData.arrayBuffer());

            console.log('📤 Step 1: Uploading file to Fortnox archive...');
            
            // Use FormData instead of manual multipart boundaries
            const form = new FormData();
            form.append('file', new Blob([fileBytes], { type: 'application/pdf' }), `bokforingsunderlag_${verificationNumber}.pdf`);

            // Upload file to Fortnox archive
            const archiveRes = await fetch('https://api.fortnox.se/3/archive', {
              method: 'POST',
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                // DO NOT set Content-Type manually — browser will handle it correctly
              },
              body: form
            });

            const archiveResponseText = await archiveRes.text();
            console.log('📤 Fortnox archive upload response:', {
              status: archiveRes.status,
              statusText: archiveRes.statusText,
              ok: archiveRes.ok,
              body: archiveResponseText.substring(0, 500) + (archiveResponseText.length > 500 ? '...' : '')
            });

            if (archiveRes.ok) {
              const archiveData = JSON.parse(archiveResponseText);
              console.log('✅ File uploaded to archive successfully:', archiveData);
              console.log('📋 Full archive response structure:', JSON.stringify(archiveData, null, 2));
              
              // Step 2: Attach archive file to voucher using voucherattachments
              const archiveFileId = archiveData.File?.ArchiveFileId;
              const fileName = archiveData.File?.Name;
              console.log('📋 Extracted ArchiveFileId for attachment:', archiveFileId);
              console.log('📋 File name for attachment:', fileName);
              
              if (archiveFileId && verificationNumber) {
                console.log('📎 Attaching archive file to voucher via /voucherattachments...', {
                  archiveFileId,
                  fileName,
                  series: 'A',
                  number: verificationNumber
                });

                const voucherAttachmentPayload = {
                  VoucherAttachment: {
                    VoucherSeries: 'A',
                    VoucherNumber: verificationNumber,
                    ArchiveFileId: archiveFileId,
                    Name: fileName || 'bokforingsunderlag.pdf'
                  }
                };
                
                console.log('📬 Posting to voucherattachments:', JSON.stringify(voucherAttachmentPayload, null, 2));

                const attachmentResponse = await fetch('https://api.fortnox.se/3/voucherattachments', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Secret': Deno.env.get('FORTNOX_CLIENT_SECRET') ?? '',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(voucherAttachmentPayload),
                });
                
                const attachmentResponseText = await attachmentResponse.text();
                console.log('📎 Voucher attachment response:', attachmentResponse.status, attachmentResponseText);
                console.log('📤 Voucher attachment response:', {
                  status: attachmentResponse.status,
                  statusText: attachmentResponse.statusText,
                  ok: attachmentResponse.ok,
                  body: attachmentResponseText.substring(0, 500) + (attachmentResponseText.length > 500 ? '...' : '')
                });

                if (!attachmentResponse.ok) {
                  console.error('❌ Failed to attach archive file to voucher:', attachmentResponseText);
                  let errorMessage = `Could not attach file to voucher: ${attachmentResponse.statusText}`;
                  
                  try {
                    const errorData = JSON.parse(attachmentResponseText);
                    if (errorData.ErrorInformation) {
                      errorMessage = `Fortnox attachment error: ${errorData.ErrorInformation.message || errorData.ErrorInformation.error}`;
                    }
                  } catch (parseError) {
                    // Use the raw response if JSON parsing fails
                    errorMessage = `Fortnox attachment error: ${attachmentResponse.status} - ${attachmentResponseText}`;
                  }
                  
                  attachmentResult = { success: false, error: `Attachment failed: ${attachmentResponseText}` };
                } else {
                  console.log('✅ File successfully attached to voucher');
                  attachmentResult = { success: true, method: 'voucherattachments', fileId: archiveFileId };
                }
              } else {
                console.log('⚠️ Missing ArchiveFileId or VoucherNumber, skipping attachment step.');
                attachmentResult = { success: false, error: 'Missing ArchiveFileId or VoucherNumber' };
              }
            } else {
              console.log('⚠️ Failed to upload file to archive:', archiveResponseText);
              attachmentResult = { success: false, error: `Fortnox archive error: ${archiveRes.status} - ${archiveResponseText}` };
            }
          }
        } catch (uploadError) {
          console.log('⚠️ Error during file upload process:', uploadError);
          attachmentResult = { success: false, error: `Upload process error: ${uploadError.message}` };
        }
      } else {
        console.log('📎 No purchase documentation found for this item');
      }

      const responseMessage = attachmentResult?.success 
        ? `${inventoryItem.registration_number} synkad till Fortnox med bokföringsunderlag`
        : attachmentResult?.error 
        ? `${inventoryItem.registration_number} synkad till Fortnox (varning: ${attachmentResult.error})`
        : `${inventoryItem.registration_number} synkad till Fortnox`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          verificationNumber,
          attachmentResult,
          message: responseMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (fortnoxError) {
      console.error('Fortnox sync failed:', fortnoxError)
      
      // Update inventory item sync status
      await supabaseClient
        .from('inventory_items')
        .update({
          fortnox_sync_status: 'failed'
        })
        .eq('id', inventoryItemId)

      // Update sync log
      if (logEntry) {
        await supabaseClient
          .from('fortnox_sync_log')
          .update({
            sync_status: 'failed',
            error_message: fortnoxError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', logEntry.id)
      }

      throw fortnoxError
    }

  } catch (error) {
    console.error('Error in fortnox-sync-purchase:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
