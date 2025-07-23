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

    // Create manual multipart/form-data payload
    const boundary = `----formdata-lovable-${Date.now()}`;
    const textEncoder = new TextEncoder();
    const parts = [];
    
    // Add file part
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Disposition: form-data; name="file"; filename="${fileName || 'bokforingsunderlag.pdf'}"\r\n`));
    parts.push(textEncoder.encode(`Content-Type: application/pdf\r\n\r\n`));
    parts.push(fileBytes);
    parts.push(textEncoder.encode(`\r\n`));
    
    // Add folderpath (optional - will create in root if not specified)
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Disposition: form-data; name="folderpath"\r\n\r\n`));
    parts.push(textEncoder.encode(`root\\vouchers\r\n`));
    
    // Close boundary
    parts.push(textEncoder.encode(`--${boundary}--\r\n`));
    
    // Calculate total length and create final body
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    console.log('📤 Multipart body created:', {
      boundary,
      totalBodySize: body.length,
      filePartSize: fileBytes.length
    });

    // Upload file to Fortnox archive (not voucherattachments)
    const archiveUploadRes = await fetch('https://api.fortnox.se/3/archive', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body
    });

    const archiveResponseText = await archiveUploadRes.text();
    console.log('📤 Fortnox archive response:', {
      status: archiveUploadRes.status,
      statusText: archiveUploadRes.statusText,
      ok: archiveUploadRes.ok,
      body: archiveResponseText.substring(0, 500) + (archiveResponseText.length > 500 ? '...' : '')
    });

    if (archiveUploadRes.ok) {
      const archiveData = JSON.parse(archiveResponseText);
      console.log('✅ File uploaded to archive successfully:', archiveData);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: archiveData, // contains Id for later linking
          message: 'File uploaded to Fortnox archive'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
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