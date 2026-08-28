import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface OpsAlertProps {
  /** Titlul alertei, ex. „Livrarea notificărilor s-a oprit”. */
  title?: string
  /** Explicație în cuvinte simple: ce s-a măsurat și ce înseamnă. */
  summary?: string
  /** Detalii brute (numere, coduri HTTP), câte una pe linie. */
  details?: string
}

const OpsAlertEmail = ({
  title = 'Alertă Suzeta',
  summary = '',
  details = '',
}: OpsAlertProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={badge}>Alertă operațională</Text>
        <Heading style={h1}>{title}</Heading>
        {summary ? <Text style={text}>{summary}</Text> : null}
        {details
          .split('\n')
          .filter(Boolean)
          .map((line, i) => (
            <Text key={i} style={mono}>
              {line}
            </Text>
          ))}
        <Hr style={hr} />
        <Text style={footer}>
          Trimis automat de verificarea de sănătate a Suzeta. Maximum un email
          pe zi per tip de alertă.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OpsAlertEmail,
  subject: (data: Record<string, any>) =>
    `[Suzeta] ${data['title'] ?? 'Alertă operațională'}`,
  displayName: 'Alertă operațională',
  previewData: {
    title: 'Livrarea notificărilor s-a oprit',
    summary: '68 de notificări așteaptă de peste 10 minute în coada de trimitere.',
    details: 'push_outbox pending > 10 min: 68',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const badge = {
  fontSize: '12px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  color: '#b42318',
  margin: '0 0 4px',
}
const h1 = { fontSize: '20px', lineHeight: '28px', color: '#101828', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '23px', color: '#344054' }
const mono = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#475467',
  fontFamily: 'Menlo, Consolas, monospace',
  margin: '2px 0',
}
const hr = { borderColor: '#eaecf0', margin: '20px 0' }
const footer = { fontSize: '12px', lineHeight: '18px', color: '#98a2b3' }
