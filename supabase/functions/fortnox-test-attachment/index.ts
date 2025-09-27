import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get active Fortnox integration
    const { data: integrations, error: integrationError } = await supabaseClient
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (integrationError) {
      console.error('Error fetching Fortnox integration:', integrationError)
      return new Response(JSON.stringify({ error: 'Failed to fetch integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ error: 'No active Fortnox integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const integration = integrations[0]

    // Create a dummy PDF file (minimal PDF structure)
    const dummyPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test file) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
297
%%EOF`

    // Convert string to bytes
    const encoder = new TextEncoder()
    const fileBytes = encoder.encode(dummyPdfContent)

    // Create multipart form data
    const boundary = '----formdata-boundary-' + Math.random().toString(36)
    
    let formData = `--${boundary}\r\n`
    formData += `Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n`
    formData += `Content-Type: application/pdf\r\n\r\n`
    
    // Add the file content
    const formDataStart = encoder.encode(formData)
    const formDataEnd = encoder.encode(`\r\n--${boundary}\r\n`)
    formData += `Content-Disposition: form-data; name="voucherSeries"\r\n\r\n`
    formData += `A\r\n` // Use series 'A' as a common default
    formData += `--${boundary}\r\n`
    formData += `Content-Disposition: form-data; name="voucherNumber"\r\n\r\n`
    formData += `1\r\n` // Use voucher number 1 as a test
    formData += `--${boundary}--\r\n`

    // Combine all parts
    const finalFormDataEnd = encoder.encode(`\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="voucherSeries"\r\n\r\n` +
      `A\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="voucherNumber"\r\n\r\n` +
      `1\r\n` +
      `--${boundary}--\r\n`)

    const payload = new Uint8Array(formDataStart.length + fileBytes.length + finalFormDataEnd.length)
    payload.set(formDataStart, 0)
    payload.set(fileBytes, formDataStart.length)
    payload.set(finalFormDataEnd, formDataStart.length + fileBytes.length)

    console.log('Testing Fortnox voucherattachments endpoint...')

    // Test the voucherattachments endpoint
    const testResponse = await fetch('https://api.fortnox.se/3/voucherattachments', {
      method: 'POST',
      headers: {
        'Access-Token': integration.access_token,
        'Client-Secret': Deno.env.get('FORTNOX_CLIENT_SECRET') || '',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: payload
    })

    const responseText = await testResponse.text()
    
    console.log(`Fortnox API response: ${testResponse.status} ${testResponse.statusText}`)
    console.log(`Response body: ${responseText}`)

    let result = {
      status: testResponse.status,
      statusText: testResponse.statusText,
      enabled: false,
      message: ''
    }

    if (testResponse.status === 403) {
      result.message = 'File attachments not enabled in Fortnox. Please enable "Koppla filer" in your Fortnox settings.'
    } else if (testResponse.status === 200 || testResponse.status === 201) {
      result.enabled = true
      result.message = 'File attachments are enabled and working!'
    } else if (testResponse.status === 400) {
      // Check if it's just a validation error (which means the feature is enabled)
      if (responseText.includes('voucher') || responseText.includes('series')) {
        result.enabled = true
        result.message = 'File attachments are enabled (validation error for test voucher is expected)'
      } else {
        result.message = `API error: ${responseText}`
      }
    } else {
      result.message = `Unexpected response: ${testResponse.status} ${responseText}`
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error testing Fortnox attachment capability:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: (error as Error).message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})