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

// Function to extract vehicle data from car.info scraped content
function extractVehicleData(content: string, regNumber: string) {
  try {
    console.log('Extracting vehicle data from car.info content for:', regNumber);
    console.log('Content sample (first 500 chars):', content.substring(0, 500));
    
    const data: any = {};
    
    // Log more specific patterns we're looking for
    console.log('Looking for patterns in content...');
    
    // Pattern 1: Try to extract from breadcrumb navigation: "Hem / Volvo / V60 / V60 / 2020"
    const breadcrumbPattern = /Hem\s*\/\s*([A-Za-z-]+)\s*\/\s*([A-Za-z0-9\s]+)\s*\/\s*[^\/]*\/\s*(\d{4})/i;
    const breadcrumbMatch = content.match(breadcrumbPattern);
    
    if (breadcrumbMatch) {
      data.brand = breadcrumbMatch[1].trim();
      data.model = breadcrumbMatch[2].trim(); 
      data.modelYear = breadcrumbMatch[3].trim();
      console.log('Extracted from breadcrumb:', { brand: data.brand, model: data.model, year: data.modelYear });
    }
    
    // Pattern 2: Try to extract from title/header format with reg number
    if (!data.brand) {
      const titlePattern = new RegExp(`${regNumber}\\s+([A-Za-z-]+)\\s+([^,]+),\\s*\\d+hk,\\s*(\\d{4})`, 'i');
      const titleMatch = content.match(titlePattern);
      
      if (titleMatch) {
        data.brand = titleMatch[1].trim();
        data.model = titleMatch[2].trim();
        data.modelYear = titleMatch[3].trim();
        console.log('Extracted from title with reg:', { brand: data.brand, model: data.model, year: data.modelYear });
      }
    }
    
    // Pattern 3: Look for direct brand model year patterns like "Volvo V60 2020"
    if (!data.brand) {
      const directPattern = /([A-Za-z-]+)\s+([A-Za-z0-9\s]+)\s+(\d{4})/g;
      let match;
      while ((match = directPattern.exec(content)) !== null) {
        const potentialBrand = match[1].trim();
        const potentialModel = match[2].trim();
        const potentialYear = match[3].trim();
        
        // Check if it looks like a car brand (common brands)
        const knownBrands = ['volvo', 'bmw', 'mercedes', 'audi', 'toyota', 'nissan', 'honda', 'ford', 'volkswagen', 'peugeot', 'citroen', 'renault', 'skoda', 'seat', 'fiat', 'hyundai', 'kia', 'mazda', 'subaru', 'mitsubishi', 'lexus', 'jaguar', 'porsche', 'lamborghini', 'ferrari', 'maserati', 'bentley', 'rolls-royce', 'aston-martin', 'mclaren', 'lotus', 'mini', 'land-rover', 'jeep', 'dodge', 'chrysler', 'cadillac', 'chevrolet', 'buick', 'gmc', 'lincoln', 'acura', 'infiniti', 'genesis', 'alfa-romeo', 'lancia', 'saab'];
        
        if (knownBrands.includes(potentialBrand.toLowerCase())) {
          data.brand = potentialBrand;
          data.model = potentialModel;
          data.modelYear = potentialYear;
          console.log('Extracted from direct pattern:', { brand: data.brand, model: data.model, year: data.modelYear });
          break;
        }
      }
    }
    
    // Pattern 4: Look for patterns in statistics/similar section
    if (!data.brand) {
      const statsMatch = content.match(/([A-Za-z-]+)\s+([A-Za-z0-9\s]+),\s*(\d{4})\s*-\s*(\d{4})/i);
      if (statsMatch) {
        data.brand = statsMatch[1].trim();
        data.model = statsMatch[2].trim();
        data.modelYear = statsMatch[4].trim(); // Use end year
        console.log('Extracted from stats section:', { brand: data.brand, model: data.model, year: data.modelYear });
      }
    }
    
    // Pattern 5: Look for detailed model info with horsepower
    if (!data.brand) {
      const detailMatch = content.match(/([A-Za-z-]+)\s+([A-Za-z0-9\s]+)\s+[0-9.]+\s+[A-Z]+.*?,\s*\d+hk,\s*(\d{4})/i);
      if (detailMatch) {
        data.brand = detailMatch[1].trim();
        data.model = detailMatch[2].trim();
        data.modelYear = detailMatch[3].trim();
        console.log('Extracted from detailed model info:', { brand: data.brand, model: data.model, year: data.modelYear });
      }
    }
    
    // After all brand/model/year extraction attempts, log what we found
    if (data.brand) {
      console.log('Successfully found brand info:', { brand: data.brand, model: data.model, year: data.modelYear });
    } else {
      console.log('No brand/model/year data found in content');
      // Log some content snippets to debug
      const contentLines = content.split('\n').slice(0, 10);
      console.log('First 10 lines of content:', contentLines);
    }
    const mileageMatch = content.match(/Mätarställning[:\s]*(\d+[\s,]*\d*)\s*mil/i);
    if (mileageMatch) {
      const mileageInMil = mileageMatch[1].replace(/[\s,]/g, '');
      // Add (km) suffix to indicate the unit
      data.mileage = `${mileageInMil} (km)`;
      console.log('Extracted mileage:', data.mileage);
    }
    
    // Extract engine info 
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
    
    // Extract generation info
    const generationMatch = content.match(/Generation[:\s]*([^\n]+)/i);
    if (generationMatch) {
      data.generation = generationMatch[1].trim();
    }
    
    // Extract equipment level
    const equipmentMatch = content.match(/Utrustningsnivå[:\s]*([^\n]+)/i);
    if (equipmentMatch) {
      data.equipmentLevel = equipmentMatch[1].trim();
    }
    
    // Extract registration date - prioritize "förregistrerad" date, then "första datum i trafik"
    // Look for förregistrerad date first
    const forregistreradMatch = content.match(/Förregistrerad[:\s]*(\d{4}-\d{2}-\d{2})/i);
    if (forregistreradMatch) {
      data.registrationDate = forregistreradMatch[1].trim();
      console.log('Extracted förregistrerad date:', data.registrationDate);
    } else {
      // Fallback to första datum i trafik
      const forstaDateMatch = content.match(/Första datum i trafik[:\s]*(\d{4}-\d{2}-\d{2})/i);
      if (forstaDateMatch) {
        data.registrationDate = forstaDateMatch[1].trim();
        console.log('Extracted första datum i trafik:', data.registrationDate);
      } else {
        // Last fallback - any date pattern, but validate against model year
        const anyDateMatch = content.match(/(\d{4}-\d{2}-\d{2})/);
        if (anyDateMatch) {
          const foundDate = anyDateMatch[1].trim();
          const foundYear = parseInt(foundDate.substring(0, 4));
          
          // Validate against model year if available
          if (data.modelYear) {
            const modelYear = parseInt(data.modelYear);
            // Date should typically be same year as model year or within 2 years
            if (Math.abs(foundYear - modelYear) <= 2) {
              data.registrationDate = foundDate;
              console.log('Extracted and validated registration date:', data.registrationDate);
            } else {
              console.log(`Date ${foundDate} rejected - too far from model year ${data.modelYear}`);
            }
          } else {
            data.registrationDate = foundDate;
            console.log('Extracted registration date (no model year validation):', data.registrationDate);
          }
        }
      }
    }
    
    // Extract indicative valuation (Indikativ värdering) for expected selling price
    const valuationMatch = content.match(/Indikativ värdering \(företag\)\s*(\d+[\s,]*\d*)\s*SEK/i);
    if (valuationMatch) {
      const valuationAmount = valuationMatch[1].replace(/[\s,]/g, '');
      data.expectedSellingPrice = parseInt(valuationAmount);
      console.log('Extracted indicative valuation:', data.expectedSellingPrice);
    }
    
    console.log('Final extracted data from car.info:', data);
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

    // No cached data found, proceed with scraping car.info
    console.log('No cached data found. Attempting to scrape car.info for:', registrationNumber);
    
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