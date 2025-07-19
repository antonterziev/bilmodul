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

    // Fetch the search results from Bolagsverket
    const searchUrl = `https://foretagsinfo.bolagsverket.se/sok-foretagsinformation-web/foretag?sokord=${encodeURIComponent(searchTerm)}`;
    
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
      console.error('Failed to fetch from Bolagsverket:', response.status, response.statusText);
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

    // Parse the HTML to extract company information
    const companies: CompanyResult[] = [];
    
    // Multiple regex patterns to catch different HTML structures
    const patterns = [
      // Standard hit-item structure
      /<div[^>]*class="[^"]*hit-item[^"]*"[^>]*>[\s\S]*?<h3[^>]*>(.*?)<\/h3>[\s\S]*?<span[^>]*>(\d{6}-\d{4})<\/span>/gi,
      // Table structure
      /<tr[^>]*>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(\d{6}-\d{4})<\/td>/gi,
      // Alternative div structure
      /<div[^>]*hit[^>]*>[\s\S]*?<.*?>(.*?)<\/.*?>[\s\S]*?(\d{6}-\d{4})/gi,
      // More flexible pattern for company name and org number
      /<[^>]*>(.*?)<\/[^>]*>[\s\S]*?(\d{6}-\d{4})/gi
    ];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(html)) !== null && companies.length < 5) {
        const rawName = match[1];
        const orgNumber = match[2];
        
        if (rawName && orgNumber) {
          // Clean up the company name
          const name = rawName
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&amp;/g, '&') // Replace HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
          
          // Skip empty names or organization numbers that appear in the name
          if (name && 
              name.length > 1 && 
              !name.match(/^\d{6}-\d{4}$/) && 
              !companies.find(c => c.orgNumber === orgNumber)) {
            companies.push({ name, orgNumber });
            console.log('Found company:', name, orgNumber);
          }
        }
      }
      
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