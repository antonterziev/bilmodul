import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { brandName, brandNames } = await req.json()
    
    // Handle both single brand and batch requests
    const brandsToProcess = brandNames || [brandName]
    const results: Record<string, string | null> = {}

    for (const brand of brandsToProcess) {
      if (!brand || brand === 'Annat') {
        results[brand] = null
        continue
      }

      console.log('Processing brand:', brand)

      // Check if logo exists in database
      const { data: existingLogo } = await supabaseClient
        .from('brand_logos')
        .select('logo_url')
        .eq('brand_name', brand.toLowerCase())
        .maybeSingle()

      if (existingLogo) {
        results[brand] = existingLogo.logo_url
        continue
      }

      // Fetch logo from external API (placeholder logic)
      try {
        const logoUrl = await fetchBrandLogoFromAPI(brand)
        
        if (logoUrl) {
          // Store in database
          await supabaseClient
            .from('brand_logos')
            .insert({
              brand_name: brand.toLowerCase(),
              logo_url: logoUrl
            })
          
          results[brand] = logoUrl
        } else {
          results[brand] = null
        }
      } catch (error) {
        console.error(`Error fetching logo for ${brand}:`, error)
        results[brand] = null
      }
    }

    // Return appropriate format based on request type
    if (brandNames) {
      return new Response(
        JSON.stringify({ logos: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          logoUrl: results[brandName], 
          fromCache: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: unknown) {
    console.error('Error in fetch-brand-logo function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchBrandLogoFromAPI(brand: string): Promise<string | null> {
  console.log(`Fetching logo for brand: ${brand}`)
  
  try {
    // Fetch the car logos dataset from GitHub
    const datasetUrl = 'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/data.json'
    
    const response = await fetch(datasetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LogoFetcher/1.0)'
      }
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch car logos dataset: ${response.status}`)
      return null
    }
    
    const logos = await response.json()
    
    // Normalize brand name for comparison (remove special characters, convert to lowercase)
    const normalizedBrand = brand.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
    
    // Find matching logo in the dataset
    const matchingLogo = logos.find((logo: any) => {
      const logoName = logo.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const logoSlug = logo.slug.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      return logoName === normalizedBrand || 
             logoSlug === normalizedBrand ||
             logoName.includes(normalizedBrand) ||
             normalizedBrand.includes(logoName)
    })
    
    if (matchingLogo) {
      console.log(`Found logo for ${brand} in GitHub dataset: ${matchingLogo.name}`)
      // Use the optimized version for better performance
      return matchingLogo.image.optimized
    }
    
    console.log(`No logo found for brand: ${brand} in GitHub dataset`)
    return null
    
  } catch (error) {
    console.error(`Error fetching logo for ${brand}:`, error)
    return null
  }
}
