import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Codul tău de verificare Ventuza</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Ventuza</Heading>
          <Text style={tagline}>Dating, elevated.</Text>
        </Section>
        <Hr style={hr} />
        <Heading style={h1}>Cod de verificare</Heading>
        <Text style={text}>
          Folosește codul de mai jos pentru a confirma identitatea ta:
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Hr style={hr} />
        <Text style={footer}>
          Codul expiră în scurt timp. Dacă nu ai cerut această verificare,
          ignoră emailul și schimbă-ți parola.
        </Text>
        <Text style={footerBrand}>Ventuza · Bucharest, RO</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif", margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '0 0 16px' }
const brand = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '34px', fontWeight: 500 as const, color: '#0E0D0B', letterSpacing: '0.08em', margin: 0 }
const tagline = { fontSize: '11px', color: '#8a7d6b', letterSpacing: '0.24em', textTransform: 'uppercase' as const, margin: '6px 0 0' }
const hr = { borderColor: '#e8e2d6', margin: '24px 0' }
const h1 = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: 500 as const, color: '#0E0D0B', margin: '0 0 16px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#2a2a2a', lineHeight: '1.65', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
  fontSize: '32px',
  fontWeight: 600 as const,
  color: '#0E0D0B',
  letterSpacing: '0.4em',
  textAlign: 'center' as const,
  backgroundColor: '#f7f3ec',
  padding: '20px',
  borderRadius: '8px',
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: '#8a8578', margin: '0 0 12px', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#8a8578', textAlign: 'center' as const, margin: '20px 0 0', letterSpacing: '0.08em' }
