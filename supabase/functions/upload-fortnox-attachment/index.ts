
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
    const { fileData, voucherSeries, voucherNumber, accessToken, fileName } = await req.json()

    if (!fileData || !voucherSeries || !voucherNumber || !accessToken) {
      throw new Error('Missing required parameters: fileData, voucherSeries, voucherNumber, accessToken')
    }

    console.log('📤 Starting Fortnox attachment upload...');
    console.log('📤 Upload details:', {
      fileName: fileName || 'bokforingsunderlag.pdf',
      voucherSeries,
      voucherNumber,
      fileSize: fileData.length
    });

    // Convert base64 file data back to bytes
    const fileBytes = new Uint8Array(
      atob(fileData)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    console.log('📤 File converted to bytes:', {
      originalBase64Length: fileData.length,
      convertedBytesLength: fileBytes.length
    });

    // Use FormData instead of manual multipart boundaries
    const form = new FormData();
    form.append('file', new Blob([fileBytes], { type: 'application/pdf' }), fileName || 'bokforingsunderlag.pdf');
    
    console.log('📤 FormData created successfully');

    // Step 1: Upload file to Fortnox archive
    const archiveUploadRes = await fetch('https://api.fortnox.se/3/archive', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        // DO NOT set Content-Type manually — browser will handle it correctly
      },
      body: form
    });

    const archiveResponseText = await archiveUploadRes.text();
    console.log('📤 Fortnox archive response:', {
      status: archiveUploadRes.status,
      statusText: archiveUploadRes.statusText,
      ok: archiveUploadRes.ok,
      body: archiveResponseText.substring(0, 500) + (archiveResponseText.length > 500 ? '...' : '')
    });

    if (!archiveUploadRes.ok) {
      console.log('⚠️ Failed to upload file to archive:', archiveResponseText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Fortnox archive error: ${archiveUploadRes.status} - ${archiveResponseText}`,
          status: archiveUploadRes.status
        }),
        { 
          status: archiveUploadRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const archiveData = JSON.parse(archiveResponseText);
    const archiveFileId = archiveData?.File?.ArchiveFileId;
    console.log('✅ Archive upload response:', archiveData);
    console.log('📋 Archive file ID for linking:', archiveFileId);

    // Step 2: Attach file to voucher using JSON payload
    const attachRes = await fetch('https://api.fortnox.se/3/voucherattachments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        VoucherAttachment: {
          VoucherSeries: voucherSeries,
          VoucherNumber: voucherNumber,
          ArchiveFileId: archiveFileId,
          Name: fileName || 'bokforingsunderlag.pdf'
        }
      })
    });

    const attachText = await attachRes.text();
    console.log('📎 Attach response:', attachRes.status, attachText);

    if (!attachRes.ok) {
      console.log('⚠️ Failed to attach file to voucher:', attachText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Fortnox attachment error: ${attachRes.status} - ${attachText}`,
          status: attachRes.status
        }),
        { 
          status: attachRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ File successfully uploaded and attached to voucher');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          ArchiveFileId: archiveFileId,
          FileName: archiveData.File.Name,
        },
        message: 'File uploaded to archive and attached to voucher'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-fortnox-attachment:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred during attachment upload'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
