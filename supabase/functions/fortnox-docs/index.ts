import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fortnox API documentation storage
let fortnoxDocs: any = null;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { method } = req;
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'get';

    if (method === 'POST' && action === 'upload') {
      // Upload documentation
      const body = await req.json();
      fortnoxDocs = body.documentation;
      
      console.log('Fortnox documentation uploaded successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Documentation uploaded successfully',
          size: JSON.stringify(fortnoxDocs).length 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    if (method === 'GET') {
      switch (action) {
        case 'search': {
          const query = url.searchParams.get('query')?.toLowerCase();
          const endpoint = url.searchParams.get('endpoint');
          const httpMethod = url.searchParams.get('method');
          
          if (!fortnoxDocs) {
            return new Response(
              JSON.stringify({ error: 'No documentation available' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404 
              }
            );
          }

          let results: any[] = [];

          // Search through the documentation structure
          if (fortnoxDocs.paths) {
            for (const [path, pathData] of Object.entries(fortnoxDocs.paths as any)) {
              for (const [method, methodData] of Object.entries(pathData as any)) {
                const item = {
                  path,
                  method: method.toUpperCase(),
                  summary: (methodData as any).summary || '',
                  description: (methodData as any).description || '',
                  parameters: (methodData as any).parameters || [],
                  responses: (methodData as any).responses || {},
                  tags: (methodData as any).tags || []
                };

                // Filter by endpoint if specified
                if (endpoint && !path.includes(endpoint)) continue;
                
                // Filter by HTTP method if specified
                if (httpMethod && method.toUpperCase() !== httpMethod.toUpperCase()) continue;
                
                // Search in content if query specified
                if (query) {
                  const searchContent = `${path} ${item.summary} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
                  if (!searchContent.includes(query)) continue;
                }

                results.push(item);
              }
            }
          }

          return new Response(
            JSON.stringify({ 
              results: results.slice(0, 50), // Limit results
              total: results.length 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }

        case 'endpoint': {
          const path = url.searchParams.get('path');
          const method = url.searchParams.get('method')?.toLowerCase();
          
          if (!fortnoxDocs || !path) {
            return new Response(
              JSON.stringify({ error: 'Missing path parameter or no documentation available' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            );
          }

          const endpointData = fortnoxDocs.paths?.[path]?.[method];
          
          if (!endpointData) {
            return new Response(
              JSON.stringify({ error: 'Endpoint not found' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404 
              }
            );
          }

          return new Response(
            JSON.stringify({
              path,
              method: method?.toUpperCase(),
              data: endpointData
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }

        case 'schemas': {
          const schemaName = url.searchParams.get('name');
          
          if (!fortnoxDocs) {
            return new Response(
              JSON.stringify({ error: 'No documentation available' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404 
              }
            );
          }

          if (schemaName) {
            const schema = fortnoxDocs.components?.schemas?.[schemaName];
            return new Response(
              JSON.stringify({ schema }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              }
            );
          }

          return new Response(
            JSON.stringify({ 
              schemas: Object.keys(fortnoxDocs.components?.schemas || {})
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }

        default: {
          // Return documentation overview
          if (!fortnoxDocs) {
            return new Response(
              JSON.stringify({ 
                message: 'No documentation uploaded yet',
                usage: {
                  upload: 'POST /?action=upload with { documentation: {...} }',
                  search: 'GET /?action=search&query=term&endpoint=/path&method=GET',
                  endpoint: 'GET /?action=endpoint&path=/accounts&method=get',
                  schemas: 'GET /?action=schemas&name=Account'
                }
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              }
            );
          }

          return new Response(
            JSON.stringify({
              info: fortnoxDocs.info || {},
              pathCount: Object.keys(fortnoxDocs.paths || {}).length,
              schemaCount: Object.keys(fortnoxDocs.components?.schemas || {}).length,
              usage: {
                search: 'GET /?action=search&query=term&endpoint=/path&method=GET',
                endpoint: 'GET /?action=endpoint&path=/accounts&method=get',
                schemas: 'GET /?action=schemas&name=Account'
              }
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    );

  } catch (error) {
    console.error('Fortnox docs function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});