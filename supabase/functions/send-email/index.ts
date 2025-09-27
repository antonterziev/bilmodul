
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    
    console.log('Received payload:', payload)
    console.log('Headers:', headers)
    
    // Temporarily skip webhook verification for debugging
    const requestData = JSON.parse(payload);
    
    const user = requestData.user;
    const email_data = requestData.email_data;
    
    if (!user || !email_data) {
      throw new Error('Missing user or email_data in payload');
    }
    
    const { token, token_hash, redirect_to, email_action_type } = email_data;
    
    console.log('Parsed data:', { user, email_action_type, token, redirect_to })

    // Handle different email types
    if (email_action_type === 'signup') {
      // Create signup verification HTML template 
      const verificationUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=https://bilmodul.se/onboarding`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f6f6;">
          <div style="background-color: white; padding: 40px 20px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="https://bilmodul.se/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul logotyp" style="height: 48px;" />
            </div>
            
            <h1 style="color: #1f2937; font-size: 28px; font-weight: bold; text-align: center; margin: 0 0 24px 0;">Välkommen till Bilmodul</h1>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 24px; text-align: center; margin: 0 0 32px 0;">
              För att göra klart din registrering, var vänlig klicka på knappen nedan
            </p>

            <!-- Verification Code Display -->
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-flex; gap: 8px; margin: 0 0 32px 0;">
                ${token.split('').map(digit => `<span style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background-color: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 24px; font-weight: bold; color: #1f2937; text-align: center;">${digit}</span>`).join('')}
              </div>
            </div>

            <!-- Main CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px;">
                Bekräfta e-post
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; line-height: 20px; text-align: center; margin: 32px 0 24px 0;">
              Om du inte försökte registrera dig för <a href="https://bilmodul.se" style="color: #2563eb; text-decoration: underline;">Bilmodul</a> kan du ignorera detta meddelande.
            </p>

            <p style="color: #6b7280; font-size: 14px; line-height: 20px; text-align: center; margin: 24px 0 0 0;">
              Med vänliga hälsningar,<br />
              Bilmodul-teamet
            </p>
          </div>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: 'Bilmodul <noreply@bilmodul.se>',
        to: [user.email],
        subject: `${token}. Använd den koden för att bekräfta din e-post`,
        html,
      })

      if (error) {
        console.error('Resend error:', error)
        throw error
      }

      console.log('Custom signup email sent successfully to:', user.email)
    } else if (email_action_type === 'recovery') {
      // Ensure we're using the correct domain - force bilmodul.se
      const correctDomain = 'https://bilmodul.se';
      let resetUrl = '';

      // Always use the correct domain regardless of what redirect_to contains
      if (redirect_to && redirect_to.includes('bilmodul.se')) {
        resetUrl = `${redirect_to}?token_hash=${token_hash}&type=recovery`;
      } else {
        // Force correct domain if redirect_to is wrong
        resetUrl = `${correctDomain}/password-reset?token_hash=${token_hash}&type=recovery`;
        console.log('Forced correct domain. Original redirect_to:', redirect_to, 'Using:', resetUrl);
      }
      
      console.log('Final reset URL being sent:', resetUrl);
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://bilmodul.se/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" style="height: 60px;" />
          </div>
          <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Återställ ditt lösenord</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Hej!</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Du har begärt att återställa ditt lösenord för Bilmodul. Klicka på knappen nedan för att skapa ett nytt lösenord:</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
              Återställ lösenord
            </a>
          </div>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Om du inte begärt denna återställning kan du ignorera detta e-postmeddelande.</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Länken är giltig i 1 timme.</p>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px; text-align: center;">Med vänlig hälsning,<br>Bilmodul-teamet</p>
          </div>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: 'Bilmodul <noreply@bilmodul.se>',
        to: [user.email],
        subject: 'Återställ ditt lösenord - Bilmodul',
        html,
      })

      if (error) {
        console.error('Resend error:', error)
        throw error
      }

      console.log('Password recovery email sent successfully to:', user.email, 'with URL:', resetUrl)
    } else {
      console.log(`Email type ${email_action_type} not handled, skipping custom email`)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Error in send-email function:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          details: error.toString(),
        },
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})
