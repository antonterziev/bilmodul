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

    // For now, return mock data for testing
    // This can be replaced with real API calls when you have API keys
    const mockData = {
      'ABC123': {
        brand: 'Tesla',
        model: 'Model Y',
        modelYear: '2023',
        mileage: '15000',
        firstRegistrationDate: '2023-06-15',
        vin: 'TSLA123456789'
      },
      'JFK123': {
        brand: 'Volvo',
        model: 'XC60',
        modelYear: '2021',
        mileage: '25000', 
        firstRegistrationDate: '2021-07-19',
        vin: 'VOLVO987654321'
      },
      'DEF456': {
        brand: 'BMW',
        model: 'X5',
        modelYear: '2022',
        mileage: '18000',
        firstRegistrationDate: '2022-03-10',
        vin: 'BMW111222333'
      }
    }

    const carData = mockData[registrationNumber.toUpperCase()]
    
    if (carData) {
      console.log('Returning mock data for:', registrationNumber, carData)
      return new Response(
        JSON.stringify(carData),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      console.log('No mock data found for:', registrationNumber)
      return new Response(
        JSON.stringify({ error: 'No data found for this registration number' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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