import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Suzeta"
const SENDER_DOMAIN = "notify.ventuza.app"
const ROOT_DOMAIN = "suzeta.app"
const FROM_DOMAIN = "notify.ventuza.app"
const SITE_URL = `https://${ROOT_DOMAIN}`

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = createAuthEmailHandler({
          apiKey: process.env['LOVABLE_API_KEY']!,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          senderDomain: SENDER_DOMAIN,
          sendUrl: process.env['LOVABLE_SEND_URL'],
          emails: {
            signup: {
              subject: 'Confirmă adresa ta de email',
              render: (data) =>
                React.createElement(SignupEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  recipient: data.email,
                  confirmationUrl: data.url,
                }),
            },
            invite: {
              subject: 'Ai primit o invitație',
              render: (data) =>
                React.createElement(InviteEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  confirmationUrl: data.url,
                }),
            },
            magiclink: {
              subject: 'Linkul tău de autentificare',
              render: (data) =>
                React.createElement(MagicLinkEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                }),
            },
            recovery: {
              subject: 'Resetează-ți parola',
              render: (data) => {
                // Recovery se deschide direct pe Suzeta; clientul consumă
                // token-ul one-time, fără a expune domeniul de infrastructură.
                const tokenHash =
                  (data as { token_hash?: string; hashed_token?: string }).token_hash ??
                  (data as { hashed_token?: string }).hashed_token
                const confirmationUrl = tokenHash
                  ? `${SITE_URL}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`
                  : data.url
                return React.createElement(RecoveryEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl,
                })
              },
            },
            email_change: {
              subject: 'Confirmă noua adresă de email',
              render: (data) =>
                React.createElement(EmailChangeEmail, {
                  siteName: SITE_NAME,
                  oldEmail: data.old_email ?? '',
                  email: data.email,
                  newEmail: data.new_email ?? '',
                  confirmationUrl: data.url,
                }),
            },
            reauthentication: {
              subject: 'Codul tău de verificare',
              render: (data) =>
                React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
            },
          },
        })
        return handler(request)
      },
    },
  },
})
