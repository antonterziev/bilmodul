import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompanyResult {
  name: string;
  orgNumber: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm } = await req.json();
    
    if (!searchTerm) {
      return new Response(
        JSON.stringify({ error: 'Search term is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Scraping company info for:', searchTerm);

    // Fetch the search results from allabolag.se
    const searchUrl = `https://www.allabolag.se/bransch-s%C3%B6k?q=${encodeURIComponent(searchTerm)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch from allabolag.se:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch company data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const html = await response.text();
    console.log('HTML length received:', html.length);

    // Parse the HTML to extract company information using simpler approach
    const companies: CompanyResult[] = [];
    
    // First, find all organization numbers
    const orgNumbers = html.match(/\d{6}-\d{4}/g) || [];
    console.log('Found org numbers:', orgNumbers.slice(0, 10));
    
    // For each org number, find the nearby company name
    for (const orgNum of orgNumbers.slice(0, 10)) {
      if (companies.length >= 5) break;
      
      const index = html.indexOf(orgNum);
      if (index > -1) {
        // Look for company name in the 300 characters before the org number
        const beforeText = html.substring(Math.max(0, index - 300), index);
        
        // Find text that looks like a company name (contains "AB" or similar patterns)
        const namePattern = /([A-ZÅÄÖ][^<>]{5,60}(?:AB|aktiebolag))/gi;
        const matches = beforeText.match(namePattern);
        
        if (matches && matches.length > 0) {
          const rawName = matches[matches.length - 1];
          const name = rawName.trim();
          
          if (!companies.find(c => c.orgNumber === orgNum)) {
            companies.push({ name, orgNumber: orgNum });
            console.log('Found company:', name, orgNum);
          }
        }
      }
    }

    // If no companies found with regex, try a simpler approach
    if (companies.length === 0) {
      console.log('No companies found with regex, trying simpler parsing...');
      
      // Look for any organization numbers in the text
      const orgNumbers = html.match(/\d{6}-\d{4}/g) || [];
      console.log('Found org numbers:', orgNumbers.slice(0, 5));
      
      // For each org number, try to find nearby company name
      for (const orgNum of orgNumbers.slice(0, 5)) {
        const index = html.indexOf(orgNum);
        if (index > -1) {
          // Look for text before the org number that might be the company name
          const beforeText = html.substring(Math.max(0, index - 200), index);
          const nameMatches = beforeText.match(/>([^<>]{5,100})</g);
          
          if (nameMatches && nameMatches.length > 0) {
            const name = nameMatches[nameMatches.length - 1]
              .replace(/>/g, '')
              .replace(/</g, '')
              .trim();
            
            if (name && !companies.find(c => c.orgNumber === orgNum)) {
              companies.push({ name, orgNumber: orgNum });
            }
          }
        }
      }
    }

    console.log('Final companies found:', companies.length);
    
    return new Response(
      JSON.stringify({ 
        companies: companies.slice(0, 5),
        searchTerm 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in scrape-company-info function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});