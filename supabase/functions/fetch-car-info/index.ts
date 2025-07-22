import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Function to extract vehicle data from Swedish Transport Authority website
function extractVehicleData(content: string, regNumber: string) {
  try {
    console.log('Extracting vehicle data from Transport Authority content for:', regNumber);
    console.log('Content sample (first 500 chars):', content.substring(0, 500));
    
    const data: any = {};
    
    // Extract Fabrikat (Brand) → Märke
    const fabrikatMatch = content.match(/Fabrikat[:\s]*([^\n\r]+)/i);
    if (fabrikatMatch) {
      data.brand = fabrikatMatch[1].trim();
      console.log('Extracted Fabrikat (brand):', data.brand);
    }
    
    // Extract Handelsbeteckning (Model) → Modell
    const handelsbeteckningMatch = content.match(/Handelsbeteckning[:\s]*([^\n\r]+)/i);
    if (handelsbeteckningMatch) {
      data.model = handelsbeteckningMatch[1].trim();
      console.log('Extracted Handelsbeteckning (model):', data.model);
    }
    
    // Extract Fordonsår (Model Year) → Modellår
    const fordonsarMatch = content.match(/Fordonsår[:\s]*(\d{4})/i);
    if (fordonsarMatch) {
      data.modelYear = fordonsarMatch[1].trim();
      console.log('Extracted Fordonsår (model year):', data.modelYear);
    }
    
    // Extract Registreringsdatum under Status section → Första datum i trafik
    // Look for Status section first, then find Registreringsdatum within that section
    const statusSectionMatch = content.match(/Status[\s\S]*?Registreringsdatum[:\s]*(\d{4}-\d{2}-\d{2})/i);
    if (statusSectionMatch) {
      const extractedDate = statusSectionMatch[1].trim();
      // Validate that the date is not in the future
      if (new Date(extractedDate) <= new Date()) {
        data.registrationDate = extractedDate;
        console.log('Extracted Registreringsdatum from Status section:', data.registrationDate);
      } else {
        console.log(`Registreringsdatum ${extractedDate} rejected - future date`);
      }
    } else {
      // Fallback: look for any Registreringsdatum
      const registreringsdatumMatch = content.match(/Registreringsdatum[:\s]*(\d{4}-\d{2}-\d{2})/i);
      if (registreringsdatumMatch) {
        const extractedDate = registreringsdatumMatch[1].trim();
        if (new Date(extractedDate) <= new Date()) {
          data.registrationDate = extractedDate;
          console.log('Extracted Registreringsdatum (fallback):', data.registrationDate);
        } else {
          console.log(`Registreringsdatum ${extractedDate} rejected - future date`);
        }
      }
    }
    
    // Log all patterns found for debugging
    if (!data.brand && !data.model && !data.modelYear && !data.registrationDate) {
      console.log('No main data found. Content analysis:');
      const lines = content.split('\n').slice(0, 20);
      console.log('First 20 lines:', lines);
    }
    
    console.log('Final extracted data from Transport Authority:', data);
    return data;
  } catch (error) {
    console.error('Error extracting vehicle data:', error);
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { registrationNumber } = await req.json()
    
    console.log('Received request for registration number:', registrationNumber)
    
    if (!registrationNumber) {
      return new Response(
        JSON.stringify({ error: 'Registration number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, check if we have cached data for this registration number
    console.log('Checking cache for registration number:', registrationNumber);
    try {
      const { data: cachedData, error: cacheError } = await supabase
        .from('scraped_car_cache')
        .select('scraped_data')
        .eq('registration_number', registrationNumber.toUpperCase())
        .single();

      if (cacheError && cacheError.code !== 'PGRST116') {
        console.error('Cache query error:', cacheError);
      } else if (cachedData) {
        console.log('Found cached data for:', registrationNumber);
        return new Response(
          JSON.stringify({ 
            ...cachedData.scraped_data, 
            fromCache: true 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } catch (error) {
      console.log('Cache check failed, proceeding with scraping:', error);
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('Firecrawl API key not found');
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // No cached data found, proceed with scraping Swedish Transport Authority
    console.log('No cached data found. Attempting to scrape Transport Authority for:', registrationNumber);
    
    try {
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://fordon-fu-regnr.transportstyrelsen.se/?regnr=${registrationNumber}`,
          formats: ['markdown', 'text'],
          onlyMainContent: true
        })
      });

      if (firecrawlResponse.ok) {
        const firecrawlData = await firecrawlResponse.json();
        console.log('Firecrawl response received');
        
        if (firecrawlData.success && firecrawlData.data) {
          const content = firecrawlData.data.markdown || firecrawlData.data.text || '';
          console.log('Content length:', content.length);
          
          const extractedData = extractVehicleData(content, registrationNumber);
          
          if (Object.keys(extractedData).length > 0) {
            console.log('Successfully extracted vehicle data:', extractedData);
            
            // Cache the extracted data for future use
            try {
              await supabase
                .from('scraped_car_cache')
                .insert({
                  registration_number: registrationNumber.toUpperCase(),
                  scraped_data: extractedData
                });
              console.log('Cached data for registration number:', registrationNumber);
            } catch (cacheInsertError) {
              console.log('Failed to cache data (this is not critical):', cacheInsertError);
            }
            
            return new Response(
              JSON.stringify(extractedData),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        }
      }
    } catch (error) {
      console.log('Transport Authority scraping failed:', error);
    }

    console.log('No vehicle data could be extracted from scraped content');
    return new Response(
      JSON.stringify({ error: 'No data found for this registration number' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in fetch-car-info function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})