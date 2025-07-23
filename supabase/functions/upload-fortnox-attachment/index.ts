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
    
    // Add voucherSeries part
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Disposition: form-data; name="voucherSeries"\r\n\r\n`));
    parts.push(textEncoder.encode(`${voucherSeries}\r\n`));
    
    // Add voucherNumber part
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Disposition: form-data; name="voucherNumber"\r\n\r\n`));
    parts.push(textEncoder.encode(`${voucherNumber.toString()}\r\n`));
    
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

    // Upload attachment to Fortnox
    const attachmentRes = await fetch('https://api.fortnox.se/3/voucherattachments', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body
    });

    const attachmentResponseText = await attachmentRes.text();
    console.log('📤 Fortnox attachment response:', {
      status: attachmentRes.status,
      statusText: attachmentRes.statusText,
      ok: attachmentRes.ok,
      body: attachmentResponseText.substring(0, 500) + (attachmentResponseText.length > 500 ? '...' : '')
    });

    if (attachmentRes.ok) {
      const attachmentData = JSON.parse(attachmentResponseText);
      console.log('✅ Attachment uploaded successfully:', attachmentData);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: attachmentData,
          message: 'Attachment uploaded successfully to Fortnox'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('⚠️ Failed to upload attachment:', attachmentResponseText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Fortnox attachment error: ${attachmentRes.status} - ${attachmentResponseText}`,
          status: attachmentRes.status
        }),
        { 
          status: attachmentRes.status,
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