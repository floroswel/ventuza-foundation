import { render } from '@react-email/render'
import React from 'react'
import { SignupEmail } from '../../dev-server/src/lib/email-templates/signup'
import { RecoveryEmail } from '../../dev-server/src/lib/email-templates/recovery'
import { MagicLinkEmail } from '../../dev-server/src/lib/email-templates/magic-link'
import { InviteEmail } from '../../dev-server/src/lib/email-templates/invite'
import { EmailChangeEmail } from '../../dev-server/src/lib/email-templates/email-change'
import { ReauthenticationEmail } from '../../dev-server/src/lib/email-templates/reauthentication'
import * as fs from 'fs'

const SITE = 'Suzeta'
const URL = 'https://suzeta.app'
const LINK = 'https://suzeta.app/auth/confirm?token=abc123'

async function main() {
  const items = [
    { label: 'Confirmare cont', subject: 'Confirmă-ți contul Suzeta', html: await render(<SignupEmail siteName={SITE} siteUrl={URL} recipient="andrei@example.com" confirmationUrl={LINK} />) },
    { label: 'Reset parolă', subject: 'Resetare parolă Suzeta', html: await render(<RecoveryEmail siteName={SITE} confirmationUrl={LINK} />) },
    { label: 'Magic link', subject: 'Link-ul tău de conectare Suzeta', html: await render(<MagicLinkEmail siteName={SITE} confirmationUrl={LINK} />) },
    { label: 'Invitație', subject: 'Ești invitat pe Suzeta', html: await render(<InviteEmail siteName={SITE} siteUrl={URL} confirmationUrl={LINK} />) },
    { label: 'Schimbare email', subject: 'Confirmă noua ta adresă de email', html: await render(<EmailChangeEmail siteName={SITE} oldEmail="vechi@example.com" email="vechi@example.com" newEmail="nou@example.com" confirmationUrl={LINK} />) },
    { label: 'Cod 2FA', subject: 'Codul tău de verificare Suzeta', html: await render(<ReauthenticationEmail token="482 917" />) },
  ]

  const page = `<!DOCTYPE html>
<html lang="ro"><head><meta charset="utf-8"><title>Suzeta — Preview emailuri</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap">
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#f2ede4; font-family:'Inter',system-ui,sans-serif; color:#0E0D0B; }
  .page { max-width: 1240px; margin: 0 auto; padding: 48px 24px 80px; }
  .head { text-align:center; margin-bottom:48px; }
  .head h1 { font-family:'Cormorant Garamond',serif; font-size:48px; font-weight:500; letter-spacing:.06em; margin:0; }
  .head p { color:#8a7d6b; letter-spacing:.24em; font-size:12px; text-transform:uppercase; margin:8px 0 0; }
  .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(520px, 1fr)); gap: 32px; }
  .card { background:#fff; border-radius:14px; overflow:hidden; box-shadow: 0 10px 40px -18px rgba(14,13,11,.25); }
  .meta { padding:20px 24px; border-bottom:1px solid #efe9dc; }
  .meta .tag { display:inline-block; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#8a7d6b; margin-bottom:6px; }
  .meta .subj { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:500; margin:0; }
  .meta .from { font-size:12px; color:#8a8578; margin-top:6px; }
  iframe { width:100%; height:720px; border:0; display:block; background:#fff; }
</style></head>
<body>
  <div class="page">
    <div class="head">
      <h1>SUZETA</h1>
      <p>Preview emailuri autentificare</p>
    </div>
    <div class="grid">
      ${items.map(it => `
        <div class="card">
          <div class="meta">
            <div class="tag">${it.label}</div>
            <p class="subj">${it.subject}</p>
            <div class="from">De la: Suzeta &lt;noreply@suzeta.app&gt;</div>
          </div>
          <iframe srcdoc="${it.html.replace(/"/g,'&quot;')}"></iframe>
        </div>`).join('')}
    </div>
  </div>
</body></html>`

  fs.mkdirSync('/mnt/documents', { recursive: true })
  fs.writeFileSync('/mnt/documents/suzeta-email-preview.html', page)
  console.log('OK', page.length, 'bytes')
}
main().catch(e => { console.error(e); process.exit(1) })
