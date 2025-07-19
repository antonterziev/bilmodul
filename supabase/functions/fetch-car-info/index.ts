import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { registrationNumber } = await req.json()
    
    if (!registrationNumber) {
      return new Response(
        JSON.stringify({ error: 'Registration number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Try car.info API first
    let carData = null
    try {
      const carInfoResponse = await fetch(`https://api.car.info/api/v1/vehicles/${registrationNumber}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Lagermodulen/1.0'
        }
      })
      
      if (carInfoResponse.ok) {
        carData = await carInfoResponse.json()
      }
    } catch (error) {
      console.log('Car.info API failed:', error)
    }

    // If car.info fails, try alternative Swedish registration API
    if (!carData) {
      try {
        // This is a hypothetical endpoint - you may need to find a working Swedish car data API
        const swedenResponse = await fetch(`https://api.biluppgifter.se/fordon/${registrationNumber}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Lagermodulen/1.0'
          }
        })
        
        if (swedenResponse.ok) {
          const swedenData = await swedenResponse.json()
          // Transform to our format
          carData = {
            brand: swedenData.marke || swedenData.brand,
            model: swedenData.modell || swedenData.model,
            modelYear: swedenData.arsmodell || swedenData.year,
            mileage: swedenData.miltal || swedenData.mileage,
            firstRegistrationDate: swedenData.forstaregistrering || swedenData.firstRegistration,
            vin: swedenData.chassinummer || swedenData.vin
          }
        }
      } catch (error) {
        console.log('Sweden API also failed:', error)
      }
    }

    if (!carData) {
      return new Response(
        JSON.stringify({ error: 'No data found for this registration number' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify(carData),
      { 
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