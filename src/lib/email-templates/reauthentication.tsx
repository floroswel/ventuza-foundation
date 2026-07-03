import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import { getEmailStrings, type EmailLocale } from './i18n'

interface Props { token: string; siteName?: string; locale?: EmailLocale }

export const ReauthenticationEmail = ({ token, siteName = 'Ventuza', locale }: Props) => {
  const t = getEmailStrings(locale)
  return (
    <Html lang={(locale as string) || 'ro'} dir="ltr">
      <Head />
      <Preview>{t.reauthentication.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>{siteName}</Heading>
            <Text style={tagline}>{t.common.tagline}</Text>
          </Section>
          <Hr style={hr} />
          <Heading style={h1}>{t.reauthentication.heading}</Heading>
          <Text style={text}>{t.reauthentication.body}</Text>
          <Text style={codeStyle}>{token}</Text>
          <Hr style={hr} />
          <Text style={footer}>{t.reauthentication.ignore}</Text>
          <Text style={footerBrand}>{siteName} · {t.common.footerLocation}</Text>
        </Container>
      </Body>
    </Html>
  )
}
export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif", margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '0 0 16px' }
const brand = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '34px', fontWeight: 500 as const, color: '#0E0D0B', letterSpacing: '0.08em', margin: 0 }
const tagline = { fontSize: '11px', color: '#8a7d6b', letterSpacing: '0.24em', textTransform: 'uppercase' as const, margin: '6px 0 0' }
const hr = { borderColor: '#e8e2d6', margin: '24px 0' }
const h1 = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: 500 as const, color: '#0E0D0B', margin: '0 0 16px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#2a2a2a', lineHeight: '1.65', margin: '0 0 20px' }
const codeStyle = { fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: '32px', fontWeight: 600 as const, color: '#0E0D0B', letterSpacing: '0.4em', textAlign: 'center' as const, backgroundColor: '#f7f3ec', padding: '20px', borderRadius: '8px', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#8a8578', margin: '0 0 12px', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#8a8578', textAlign: 'center' as const, margin: '20px 0 0', letterSpacing: '0.08em' }
