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
  
  // Known high-quality logo sources with transparent backgrounds
  const logoSources = {
    'tesla': 'https://logos-world.net/wp-content/uploads/2021/03/Tesla-Logo.png',
    'volvo': 'https://logos-world.net/wp-content/uploads/2020/08/Volvo-Logo.png',
    'bmw': 'https://logos-world.net/wp-content/uploads/2020/04/BMW-Logo.png',
    'mercedes': 'https://logos-world.net/wp-content/uploads/2020/04/Mercedes-Benz-Logo.png',
    'mercedes-benz': 'https://logos-world.net/wp-content/uploads/2020/04/Mercedes-Benz-Logo.png',
    'audi': 'https://logos-world.net/wp-content/uploads/2020/04/Audi-Logo.png',
    'volkswagen': 'https://logos-world.net/wp-content/uploads/2020/04/Volkswagen-Logo.png',
    'ford': 'https://logos-world.net/wp-content/uploads/2020/08/Ford-Logo.png',
    'toyota': 'https://logos-world.net/wp-content/uploads/2020/06/Toyota-Logo.png',
    'honda': 'https://logos-world.net/wp-content/uploads/2020/06/Honda-Logo.png',
    'nissan': 'https://logos-world.net/wp-content/uploads/2020/06/Nissan-Logo.png',
    'porsche': 'https://logos-world.net/wp-content/uploads/2020/06/Porsche-Logo.png',
    'ferrari': 'https://logos-world.net/wp-content/uploads/2020/06/Ferrari-Logo.png',
    'lamborghini': 'https://logos-world.net/wp-content/uploads/2020/06/Lamborghini-Logo.png',
    'maserati': 'https://logos-world.net/wp-content/uploads/2020/06/Maserati-Logo.png',
    'jaguar': 'https://logos-world.net/wp-content/uploads/2020/06/Jaguar-Logo.png',
    'land rover': 'https://logos-world.net/wp-content/uploads/2020/06/Land-Rover-Logo.png',
    'bentley': 'https://logos-world.net/wp-content/uploads/2020/06/Bentley-Logo.png',
    'rolls-royce': 'https://logos-world.net/wp-content/uploads/2020/06/Rolls-Royce-Logo.png',
    'aston martin': 'https://logos-world.net/wp-content/uploads/2020/06/Aston-Martin-Logo.png',
    'mclaren': 'https://logos-world.net/wp-content/uploads/2020/06/McLaren-Logo.png',
    'lotus': 'https://logos-world.net/wp-content/uploads/2020/06/Lotus-Logo.png',
    'mini': 'https://logos-world.net/wp-content/uploads/2020/06/Mini-Logo.png',
    'smart': 'https://logos-world.net/wp-content/uploads/2020/06/Smart-Logo.png',
    'fiat': 'https://logos-world.net/wp-content/uploads/2020/06/Fiat-Logo.png',
    'alfa romeo': 'https://logos-world.net/wp-content/uploads/2020/06/Alfa-Romeo-Logo.png',
    'lancia': 'https://logos-world.net/wp-content/uploads/2020/06/Lancia-Logo.png',
    'maserati': 'https://logos-world.net/wp-content/uploads/2020/06/Maserati-Logo.png',
    'skoda': 'https://logos-world.net/wp-content/uploads/2020/06/Skoda-Logo.png',
    'seat': 'https://logos-world.net/wp-content/uploads/2020/06/SEAT-Logo.png',
    'opel': 'https://logos-world.net/wp-content/uploads/2020/06/Opel-Logo.png',
    'peugeot': 'https://logos-world.net/wp-content/uploads/2020/06/Peugeot-Logo.png',
    'citroen': 'https://logos-world.net/wp-content/uploads/2020/06/Citroen-Logo.png',
    'renault': 'https://logos-world.net/wp-content/uploads/2020/06/Renault-Logo.png',
    'dacia': 'https://logos-world.net/wp-content/uploads/2020/06/Dacia-Logo.png'
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