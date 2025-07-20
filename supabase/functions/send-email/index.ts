import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { SignupVerificationEmail } from './_templates/signup-verification.tsx'

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
    
    console.log('Parsed data:', { user, email_action_type, token })

    // Handle different email types
    if (email_action_type === 'signup') {
      const html = await renderAsync(
        React.createElement(SignupVerificationEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to,
          email_action_type,
          user_email: user.email,
        })
      )

      const { data, error } = await resend.emails.send({
        from: 'Veksla <noreply@lagermodulen.se>',
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
      // Send password recovery email
      const resetUrl = `${redirect_to}?token_hash=${token_hash}&type=recovery`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Återställ ditt lösenord</h1>
          <p>Hej!</p>
          <p>Du har begärt att återställa ditt lösenord för Veksla. Klicka på länken nedan för att skapa ett nytt lösenord:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Återställ lösenord
            </a>
          </p>
          <p>Om du inte begärt denna återställning kan du ignorera detta e-postmeddelande.</p>
          <p>Länken är giltig i 1 timme.</p>
          <p>Med vänlig hälsning,<br>Veksla-teamet</p>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: 'Veksla <noreply@lagermodulen.se>',
        to: [user.email],
        subject: 'Återställ ditt lösenord - Veksla',
        html,
      })

      if (error) {
        console.error('Resend error:', error)
        throw error
      }

      console.log('Password recovery email sent successfully to:', user.email)
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