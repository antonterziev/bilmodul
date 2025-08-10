import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Button,
  Img,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface SignupVerificationEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
  user_email: string
}

export const SignupVerificationEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
  user_email,
}: SignupVerificationEmailProps) => (
  <Html>
    <Head />
    <Preview>Välkommen till Bilmodul - Bekräfta din e-post</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Veksla Logo */}
        <div style={logoContainer}>
          <Img src="https://bilmodul.se/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul logotyp" style={{ height: '48px', margin: '0 auto' }} />
        </div>
        
        <Heading style={h1}>Välkommen till Bilmodul</Heading>
        
        <Text style={text}>
          För att göra klart din registrering, var vänlig klicka på knappen nedan
        </Text>

        {/* Verification Code Display */}
        <div style={codeContainer}>
          <div style={codeBox}>
            {token.split('').map((digit, index) => (
              <span key={index} style={codeDigit}>{digit}</span>
            ))}
          </div>
        </div>

        {/* Main CTA Button */}
        <div style={buttonContainer}>
          <Link
            href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=https://bilmodul.se/onboarding`}
            style={button}
          >
            Bekräfta e-post
          </Link>
        </div>

        <Text style={footerText}>
          Om du inte försökte registrera dig för <Link href="https://bilmodul.se" style={link}>Bilmodul</Link> kan du ignorera detta meddelande.
        </Text>

        <Text style={footer}>
          Med vänliga hälsningar,<br />
          Bilmodul-teamet
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupVerificationEmail

const main = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
  borderRadius: '8px',
}

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const logoText = {
  fontSize: '32px',
  fontWeight: 'bold',
  color: '#2563eb',
  margin: '0',
}

const h1 = {
  color: '#1f2937',
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
}

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  margin: '0 0 32px 0',
}

const codeContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const codeLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 12px 0',
}

const codeBox = {
  display: 'flex',
  justifyContent: 'center',
  gap: '8px',
  margin: '0 0 32px 0',
}

const codeDigit = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '48px',
  height: '48px',
  backgroundColor: '#f3f4f6',
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1f2937',
  textAlign: 'center' as const,
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '32px 0 24px 0',
}

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '24px 0 0 0',
}

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
}