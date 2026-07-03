import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Confirmă-ți contul {siteName} — un singur pas.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{siteName}</Heading>
          <Text style={tagline}>Dating, elevated.</Text>
        </Section>
        <Hr style={hr} />
        <Heading style={h1}>Bine ai venit.</Heading>
        <Text style={text}>
          Mulțumim că ți-ai creat cont pe <strong>{siteName}</strong>. Pentru a-ți
          activa profilul și a începe să întâlnești oameni cu care rezonezi,
          confirmă adresa ta de email:
        </Text>
        <Text style={emailBadge}>{recipient}</Text>
        <Section style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>
            Confirmă adresa de email
          </Button>
        </Section>
        <Text style={smallText}>
          Sau copiază acest link în browser:
          <br />
          <Link href={confirmationUrl} style={linkPlain}>{confirmationUrl}</Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Dacă nu ai creat un cont pe {siteName}, poți ignora acest email fără
          griji — nu se va întâmpla nimic.
        </Text>
        <Text style={footerBrand}>
          <Link href={siteUrl} style={footerLink}>{siteName}</Link> · Bucharest, RO
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  margin: 0,
  padding: 0,
}
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '0 0 16px' }
const brand = {
  fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  fontSize: '34px',
  fontWeight: 500 as const,
  color: '#0E0D0B',
  letterSpacing: '0.08em',
  margin: 0,
}
const tagline = {
  fontSize: '11px',
  color: '#8a7d6b',
  letterSpacing: '0.24em',
  textTransform: 'uppercase' as const,
  margin: '6px 0 0',
}
const hr = { borderColor: '#e8e2d6', margin: '24px 0' }
const h1 = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '28px',
  fontWeight: 500 as const,
  color: '#0E0D0B',
  margin: '0 0 16px',
  lineHeight: '1.2',
}
const text = {
  fontSize: '15px',
  color: '#2a2a2a',
  lineHeight: '1.65',
  margin: '0 0 16px',
}
const smallText = {
  fontSize: '12px',
  color: '#8a8578',
  lineHeight: '1.6',
  margin: '20px 0 0',
  wordBreak: 'break-all' as const,
}
const emailBadge = {
  display: 'inline-block',
  padding: '8px 14px',
  backgroundColor: '#f7f3ec',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#0E0D0B',
  fontWeight: 500 as const,
  margin: '0 0 28px',
}
const buttonWrap = { textAlign: 'center' as const, margin: '8px 0 20px' }
const button = {
  backgroundColor: '#0E0D0B',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 500 as const,
  borderRadius: '999px',
  padding: '14px 36px',
  textDecoration: 'none',
  display: 'inline-block',
  letterSpacing: '0.02em',
}
const linkPlain = { color: '#8a7d6b', textDecoration: 'underline', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#8a8578', margin: '0 0 12px', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#8a8578', textAlign: 'center' as const, margin: '20px 0 0', letterSpacing: '0.08em' }
const footerLink = { color: '#0E0D0B', textDecoration: 'none', fontWeight: 500 as const }
