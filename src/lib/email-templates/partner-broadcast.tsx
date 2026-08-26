import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface PartnerBroadcastProps {
  title?: string
  body?: string
  link?: string
}

const PartnerBroadcastEmail = ({
  title = 'Noutăți din Suzeta',
  body = '',
  link = 'https://suzeta.app',
}: PartnerBroadcastProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title}</Heading>
        {body
          .split('\n')
          .filter(Boolean)
          .map((line, i) => (
            <Text key={i} style={text}>
              {line}
            </Text>
          ))}
        <Button style={button} href={link}>
          Deschide în Suzeta
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          Primești acest email pentru că ai activat comunicări marketing în Suzeta.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PartnerBroadcastEmail,
  subject: (data: Record<string, any>) => `Suzeta: ${data['title'] ?? 'Noutăți'}`,
  displayName: 'Anunț partener',
  previewData: {
    title: 'Petrecere la Club Exemplu',
    body: 'Vineri de la 22:00, intrare liberă pentru membrii Suzeta.',
    link: 'https://suzeta.app/venues',
  },
} satisfies TemplateEntry

export default PartnerBroadcastEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }
const container = { padding: '24px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: '700', color: '#18181b', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#3f3f46', margin: '0 0 12px' }
const button = {
  backgroundColor: '#e11d48',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '11px 20px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 0',
}
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#71717a', margin: '0' }
