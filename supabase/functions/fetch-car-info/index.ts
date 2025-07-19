import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to extract vehicle data from car.info scraped content
function extractVehicleData(content: string, regNumber: string) {
  try {
    console.log('Extracting vehicle data from car.info content for:', regNumber);
    
    const data: any = {};
    
    // Extract mileage (Mätarställning)
    const mileageMatch = content.match(/Mätarställning[:\s]*(\d+[\s,]*\d*)\s*mil/i);
    if (mileageMatch) {
      const mileageInMil = mileageMatch[1].replace(/[\s,]/g, '');
      // Convert from Swedish mil to kilometers (1 mil = 10 km)
      data.mileage = (parseInt(mileageInMil) * 10).toString();
    }
    
    // Extract engine info which often contains brand info
    const motorMatch = content.match(/Motor[:\s]*([^,\n]+)/i);
    if (motorMatch) {
      data.engineInfo = motorMatch[1].trim();
    }
    
    // Extract body type (Kaross)
    const bodyMatch = content.match(/Kaross[:\s]*([^\n]+)/i);
    if (bodyMatch) {
      data.bodyType = bodyMatch[1].trim();
    }
    
    // Extract color (Färg)
    const colorMatch = content.match(/Färg[:\s]*([^\n]+)/i);
    if (colorMatch) {
      data.color = colorMatch[1].trim();
    }
    
    // Extract transmission (Växellåda)
    const transmissionMatch = content.match(/Växellåda[:\s]*([^\n]+)/i);
    if (transmissionMatch) {
      data.transmission = transmissionMatch[1].trim();
    }
    
    // Extract drivetrain (Drivlina)
    const drivetrainMatch = content.match(/Drivlina[:\s]*([^\n]+)/i);
    if (drivetrainMatch) {
      data.drivetrain = drivetrainMatch[1].trim();
    }
    
    // Extract generation info which might help identify model
    const generationMatch = content.match(/Generation[:\s]*([^\n]+)/i);
    if (generationMatch) {
      data.generation = generationMatch[1].trim();
    }
    
    // Extract equipment level
    const equipmentMatch = content.match(/Utrustningsnivå[:\s]*([^\n]+)/i);
    if (equipmentMatch) {
      data.equipmentLevel = equipmentMatch[1].trim();
    }
    
    // Try to extract year from generation or other context
    const yearMatch = content.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        data.modelYear = yearMatch[1];
      }
    }
    
    console.log('Extracted data from car.info:', data);
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