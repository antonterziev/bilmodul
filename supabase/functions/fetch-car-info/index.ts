import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to extract vehicle data from scraped content
function extractVehicleData(content: string, regNumber: string) {
  try {
    console.log('Extracting vehicle data from content for:', regNumber);
    
    // Look for common patterns in car.info or similar sites
    const data: any = {};
    
    // Extract brand/make
    const brandMatch = content.match(/(?:brand|make|märke|tillverkare)[:\s]+([a-zA-ZÅÄÖåäö\s]+)/i);
    if (brandMatch) {
      data.brand = brandMatch[1].trim();
    }
    
    // Extract model
    const modelMatch = content.match(/(?:model|modell)[:\s]+([a-zA-Z0-9\s\-_]+)/i);
    if (modelMatch) {
      data.model = modelMatch[1].trim();
    }
    
    // Extract year
    const yearMatch = content.match(/(?:year|år|årsmodell|model year)[:\s]+(\d{4})/i);
    if (yearMatch) {
      data.modelYear = yearMatch[1];
    }
    
    // Extract mileage/odometer
    const mileageMatch = content.match(/(?:mileage|miltal|kilometer|km)[:\s]+([0-9,\s]+)/i);
    if (mileageMatch) {
      data.mileage = mileageMatch[1].replace(/[,\s]/g, '');
    }
    
    // Extract VIN/chassis number
    const vinMatch = content.match(/(?:vin|chassis|chassinummer)[:\s]+([A-Z0-9]+)/i);
    if (vinMatch) {
      data.vin = vinMatch[1];
    }
    
    // Extract first registration date
    const regDateMatch = content.match(/(?:first registration|första registrering|registreringsdatum)[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
    if (regDateMatch) {
      data.firstRegistrationDate = regDateMatch[1];
    }
    
    console.log('Extracted data:', data);
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

    // Try scraping car.info
    console.log('Attempting to scrape car.info for:', registrationNumber);
    
    try {
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.car.info/sv-se/license-plate/S/${registrationNumber}`,
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
      console.log('Car.info scraping failed:', error);
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