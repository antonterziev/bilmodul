import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FortnoxCustomer {
  CustomerNumber: string
  Name: string
  Email?: string
  Phone?: string
  OrganisationNumber?: string
}

interface FortnoxInvoice {
  DocumentNumber: string
  InvoiceDate: string
  DueDate: string
  CustomerNumber: string
  Total: number
  Balance: number
  Currency: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid token')
    }

    const { action, entity_type, entity_data } = await req.json()

    // Get the user's Fortnox integration
    const { data: integration } = await supabase
      .from('fortnox_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!integration) {
      throw new Error('No active Fortnox integration found')
    }

    // Check if token needs refresh
    const now = new Date()
    const expiresAt = new Date(integration.token_expires_at)
    
    if (now >= expiresAt) {
      // Token expired, try to refresh
      const refreshResult = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fortnox-oauth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'refresh_token' }),
      })

      if (!refreshResult.ok) {
        throw new Error('Failed to refresh Fortnox token')
      }

      // Get updated integration
      const { data: updatedIntegration } = await supabase
        .from('fortnox_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!updatedIntegration) {
        throw new Error('Failed to get updated integration')
      }

      integration.access_token = updatedIntegration.access_token
    }

    if (action === 'sync_customers') {
      // Fetch customers from Fortnox
      const customersResponse = await fetch('https://api.fortnox.se/3/customers', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json',
        },
      })

      if (!customersResponse.ok) {
        throw new Error(`Failed to fetch customers: ${customersResponse.status}`)
      }

      const customersData = await customersResponse.json()
      const customers = customersData.Customers || []

      return new Response(
        JSON.stringify({ 
          success: true, 
          customers: customers.slice(0, 50), // Limit to 50 for demo
          total: customers.length 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'sync_invoices') {
      // Fetch invoices from Fortnox
      const invoicesResponse = await fetch('https://api.fortnox.se/3/invoices', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json',
        },
      })

      if (!invoicesResponse.ok) {
        throw new Error(`Failed to fetch invoices: ${invoicesResponse.status}`)
      }

      const invoicesData = await invoicesResponse.json()
      const invoices = invoicesData.Invoices || []

      return new Response(
        JSON.stringify({ 
          success: true, 
          invoices: invoices.slice(0, 50), // Limit to 50 for demo
          total: invoices.length 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'create_customer') {
      // Create a customer in Fortnox
      const customerData = {
        Name: entity_data.name,
        Email: entity_data.email,
        Phone: entity_data.phone,
        OrganisationNumber: entity_data.org_number,
      }

      const createResponse = await fetch('https://api.fortnox.se/3/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ Customer: customerData }),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        throw new Error(`Failed to create customer: ${createResponse.status} - ${errorText}`)
      }

      const result = await createResponse.json()

      return new Response(
        JSON.stringify({ 
          success: true, 
          customer: result.Customer 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'create_invoice') {
      // Create an invoice in Fortnox
      const invoiceData = {
        CustomerNumber: entity_data.customer_number,
        InvoiceDate: entity_data.invoice_date,
        DueDate: entity_data.due_date,
        Currency: entity_data.currency || 'SEK',
        InvoiceRows: entity_data.invoice_rows || [],
      }

      const createResponse = await fetch('https://api.fortnox.se/3/invoices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ Invoice: invoiceData }),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        throw new Error(`Failed to create invoice: ${createResponse.status} - ${errorText}`)
      }

      const result = await createResponse.json()

      return new Response(
        JSON.stringify({ 
          success: true, 
          invoice: result.Invoice 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Fortnox sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})