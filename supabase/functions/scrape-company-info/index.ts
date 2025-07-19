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

    // Parse the HTML to extract company information using the exact allabolag structure
    const companies: CompanyResult[] = [];
    
    // Look for the specific pattern: Company name (often highlighted) followed by "Org.nr" and then the number
    const companyPatterns = [
      // Pattern: Company name in any element, then "Org.nr" then the actual number
      />([^<>]+?(?:AB|aktiebolag|Spa|Massage|Utveckling|Invest)[^<>]*)<[^>]*>[\s\S]*?Org\.nr[^>]*>?[^<]*(\d{6}-\d{4})/gi,
      // Pattern: Any company name before "Org.nr" pattern
      />([A-ZÅÄÖ][^<>]{5,60})<[^>]*>[\s\S]*?Org\.nr[^>]*>?[^<]*(\d{6}-\d{4})/gi,
      // Pattern: Company name in link/highlighted text before org number
      /<[^>]*>([^<>]+?(?:AB|Spa|Massage|Utveckling|Invest|aktiebolag)[^<>]*)<\/[^>]*>[\s\S]*?(\d{6}-\d{4})/gi,
      // Broader pattern: any text that looks like company name before org number
      /<[^>]*>([A-ZÅÄÖ][A-Za-zÅÄÖåäö\s&-]{8,50})<\/[^>]*>[\s\S]*?(\d{6}-\d{4})/gi
    ];

    for (const pattern of companyPatterns) {
      let match;
      
      while ((match = pattern.exec(html)) !== null && companies.length < 5) {
        const rawName = match[1];
        const orgNumber = match[2];
        
        if (rawName && orgNumber) {
          // Clean up the company name
          const name = rawName
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Validate this is a real company name, not UI text or "Org.nr"
          if (name && 
              name.length > 3 && 
              !name.toLowerCase().includes('org.nr') &&
              !name.toLowerCase().includes('org nr') &&
              !name.toLowerCase().includes('synas på') &&
              !name.toLowerCase().includes('hitta') &&
              !name.toLowerCase().includes('jämför') &&
              !name.toLowerCase().includes('bevaka') &&
              !name.toLowerCase().includes('köp') &&
              !name.toLowerCase().includes('lista') &&
              !name.match(/^\d/) && // Don't start with numbers
              !companies.find(c => c.orgNumber === orgNumber)) {
            companies.push({ name, orgNumber });
            console.log('Found company:', name, orgNumber);
          }
        }
      }
      
      // Reset regex for next iteration
      pattern.lastIndex = 0;
      
      if (companies.length >= 5) break;
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