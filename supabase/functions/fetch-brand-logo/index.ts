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

  } catch (error) {
    console.error('Error in fetch-brand-logo function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchBrandLogoFromAPI(brand: string): Promise<string | null> {
  // Placeholder for actual logo fetching logic
  // This would typically call an external API like Clearbit, Google Images API, etc.
  console.log(`Fetching logo for brand: ${brand}`)
  
  // For now, return null to maintain existing behavior
  // Real implementation would go here
  return null
}
