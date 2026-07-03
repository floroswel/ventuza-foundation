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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Confirmă schimbarea adresei de email pentru {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{siteName}</Heading>
          <Text style={tagline}>Dating, elevated.</Text>
        </Section>
        <Hr style={hr} />
        <Heading style={h1}>Confirmă adresa nouă de email</Heading>
        <Text style={text}>
          Ai cerut schimbarea adresei de email a contului {siteName} de la{' '}
          <Link href={`mailto:${oldEmail}`} style={linkPlain}>{oldEmail}</Link>{' '}
          la{' '}
          <Link href={`mailto:${newEmail}`} style={linkPlain}>{newEmail}</Link>.
        </Text>
        <Section style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>Confirmă schimbarea</Button>
        </Section>
        <Text style={smallText}>
          Sau copiază acest link:<br />
          <Link href={confirmationUrl} style={linkPlain}>{confirmationUrl}</Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Dacă nu tu ai cerut această schimbare, securizează-ți contul imediat
          din setări.
        </Text>
        <Text style={footerBrand}>{siteName} · Bucharest, RO</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif", margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '0 0 16px' }
const brand = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '34px', fontWeight: 500 as const, color: '#0E0D0B', letterSpacing: '0.08em', margin: 0 }
const tagline = { fontSize: '11px', color: '#8a7d6b', letterSpacing: '0.24em', textTransform: 'uppercase' as const, margin: '6px 0 0' }
const hr = { borderColor: '#e8e2d6', margin: '24px 0' }
const h1 = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: 500 as const, color: '#0E0D0B', margin: '0 0 16px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#2a2a2a', lineHeight: '1.65', margin: '0 0 20px' }
const smallText = { fontSize: '12px', color: '#8a8578', lineHeight: '1.6', margin: '20px 0 0', wordBreak: 'break-all' as const }
const buttonWrap = { textAlign: 'center' as const, margin: '8px 0 20px' }
const button = { backgroundColor: '#0E0D0B', color: '#ffffff', fontSize: '15px', fontWeight: 500 as const, borderRadius: '999px', padding: '14px 36px', textDecoration: 'none', display: 'inline-block', letterSpacing: '0.02em' }
const linkPlain = { color: '#8a7d6b', textDecoration: 'underline', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#8a8578', margin: '0 0 12px', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#8a8578', textAlign: 'center' as const, margin: '20px 0 0', letterSpacing: '0.08em' }
