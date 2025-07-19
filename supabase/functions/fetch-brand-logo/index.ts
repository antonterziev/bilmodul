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

// Function to search for brand logos with transparent background
async function searchBrandLogo(brandName: string): Promise<string | null> {
  try {
    console.log('Searching for logo for brand:', brandName);
    
    // Use a combination of search terms to find high-quality logos
    const searchQueries = [
      `${brandName} car brand logo transparent background PNG`,
      `${brandName} automotive logo vector transparent`,
      `${brandName} car manufacturer logo PNG transparent`
    ];
    
    for (const query of searchQueries) {
      try {
        // Using Google Custom Search API or similar would be ideal here
        // For now, we'll use a placeholder approach with known logo sources
        const logoUrl = await findLogoFromKnownSources(brandName);
        if (logoUrl) {
          return logoUrl;
        }
      } catch (error) {
        console.log(`Search failed for query "${query}":`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching for brand logo:', error);
    return null;
  }
}

// Function to find logos from known sources
async function findLogoFromKnownSources(brandName: string): Promise<string | null> {
  const brand = brandName.toLowerCase();
  
  // Known high-quality logo sources - using direct SVG files
  const logoSources = {
    'tesla': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Tesla_T_symbol.svg',
    'volvo': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Volvo_Cars_logo.svg',
    'bmw': 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg',
    'mercedes': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
    'mercedes-benz': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
    'audi': 'https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg',
    'volkswagen': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg',
    'ford': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Ford_logo_flat.svg',
    'toyota': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Toyota_Motor_Logo.svg',
    'honda': 'https://upload.wikimedia.org/wikipedia/commons/7/76/Honda_logo.svg',
    'nissan': 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Nissan-logo.svg',
    'porsche': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Porsche_logo.svg',
    'ferrari': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Ferrari_logo.svg',
    'lamborghini': 'https://upload.wikimedia.org/wikipedia/commons/d/df/Lamborghini_Logo.svg',
    'maserati': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Maserati_logo.svg',
    'jaguar': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Jaguar_logo_2012.svg',
    'land rover': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Land_Rover_logo.svg',
    'bentley': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Bentley_logo.svg',
    'rolls-royce': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Rolls-Royce_Motor_Cars_logo.svg',
    'aston martin': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Aston_Martin_logo.svg',
    'mclaren': 'https://upload.wikimedia.org/wikipedia/commons/2/24/McLaren_logo.svg',
    'mini': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/MINI_logo.svg',
    'fiat': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Fiat_logo.svg',
    'alfa romeo': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Alfa_Romeo_logo_2015.svg',
    'skoda': 'https://upload.wikimedia.org/wikipedia/commons/7/78/Skoda_Auto_logo.svg',
    'seat': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/SEAT_logo.svg',
    'opel': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Opel-Logo-2017.svg',
    'peugeot': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Peugeot_logo.svg',
    'citroen': 'https://upload.wikimedia.org/wikipedia/commons/1/14/Citro%C3%ABn_logo.svg',
    'renault': 'https://upload.wikimedia.org/wikipedia/commons/4/49/Renault_logo.svg',
    'dacia': 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Dacia_Logo.svg',
    'kia': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Kia_logo2.svg',
    'hyundai': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg',
    'mazda': 'https://upload.wikimedia.org/wikipedia/commons/2/2d/Mazda_logo.svg',
    'subaru': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Subaru_logo.svg',
    'mitsubishi': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Mitsubishi_logo.svg',
    'lexus': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Lexus_logo.svg',
    'infiniti': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Infiniti_logo.svg',
    'acura': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Acura_logo.svg'
  };
  
  return logoSources[brand] || null;
}

// Function to download and store logo
async function downloadAndStoreLogo(brandName: string, logoUrl: string): Promise<string | null> {
  try {
    console.log('Downloading logo from:', logoUrl);
    
    // Download the image
    const response = await fetch(logoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download logo: ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    const fileName = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-logo.png`;
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brand-logos')
      .upload(fileName, imageBlob, {
        upsert: true,
        contentType: 'image/png'
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload logo: ${uploadError.message}`);
    }
    
    console.log('Logo uploaded successfully:', uploadData.path);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('brand-logos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  } catch (error) {
    console.error('Error downloading and storing logo:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { brandName } = await req.json()
    
    console.log('Received request for brand logo:', brandName)
    
    if (!brandName) {
      return new Response(
        JSON.stringify({ error: 'Brand name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, check if we already have this logo in the database
    console.log('Checking if logo already exists for:', brandName);
    const { data: existingLogo, error: existingError } = await supabase
      .from('brand_logos')
      .select('logo_url, file_path')
      .eq('brand_name', brandName.toLowerCase())
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Database query error:', existingError);
    } else if (existingLogo) {
      console.log('Found existing logo for:', brandName);
      return new Response(
        JSON.stringify({ 
          logoUrl: existingLogo.logo_url,
          fromCache: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // No existing logo found, search for one
    console.log('No existing logo found. Searching for logo for:', brandName);
    const logoUrl = await searchBrandLogo(brandName);
    
    if (!logoUrl) {
      console.log('No logo found for brand:', brandName);
      return new Response(
        JSON.stringify({ error: 'No logo found for this brand' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Download and store the logo
    const storedLogoUrl = await downloadAndStoreLogo(brandName, logoUrl);
    
    if (!storedLogoUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to download and store logo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Save logo info to database
    const { error: insertError } = await supabase
      .from('brand_logos')
      .insert({
        brand_name: brandName.toLowerCase(),
        logo_url: storedLogoUrl,
        file_path: `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-logo.png`
      });

    if (insertError) {
      console.error('Failed to save logo info to database:', insertError);
      // Continue anyway, we have the logo URL
    } else {
      console.log('Logo info saved to database for:', brandName);
    }

    return new Response(
      JSON.stringify({ 
        logoUrl: storedLogoUrl,
        fromCache: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in fetch-brand-logo function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})