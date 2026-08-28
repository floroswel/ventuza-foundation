/**
 * Webhook-ul de email pentru autentificare (Supabase Auth → Lovable Email).
 *
 * DE CE A FOST REFĂCUT: fișierul importa `createAuthEmailHandler` din
 * `@lovable.dev/email-js`, funcție care NU există în pachet (v0.0.4 exportă
 * doar `sendLovableEmail`, `parseEmailWebhookPayload` și `EmailAPIError`).
 * Consecințele erau mult mai mari decât un email nelivrat:
 *
 *   · în Node ESM, importul unui export inexistent aruncă la ÎNCĂRCAREA
 *     modulului, nu la apel. Ruta face parte din arborele de rute, deci
 *     `loadEntries()` eșua și ÎNTREG server entry-ul răspundea 500;
 *   · prerender-ul din `bun run build:mobile` cade cu „Failed to fetch /",
 *     deci bundle-ul mobil nu se putea construi local deloc;
 *   · `tsc --noEmit` raporta erorile, dar treceau neobservate.
 *
 * Rescris peste API-ul real. Comportamentul de email rămâne identic:
 * aceleași subiecte, aceleași șabloane, aceleași proprietăți.
 *
 * SEMNĂTURĂ — fail-closed: endpoint-ul trimite emailuri către adrese primite
 * din exterior, deci un apelant neverificat l-ar putea folosi ca releu de
 * spam în numele domeniului nostru. Fără `LOVABLE_WEBHOOK_SECRET` configurat,
 * refuzăm; nu trimitem „doar de data asta".
 */
import * as React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { verifyWebhookRequest, WebhookError } from "@lovable.dev/webhooks-js";
import type { EmailWebhookPayload } from "@lovable.dev/webhooks-js";
import { createFileRoute } from "@tanstack/react-router";

import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

const SITE_NAME = "Suzeta";
const SENDER_DOMAIN = "notify.ventuza.app";
const ROOT_DOMAIN = "suzeta.app";
const FROM_DOMAIN = "notify.ventuza.app";
const SITE_URL = `https://${ROOT_DOMAIN}`;

/** Câmpurile pe care Supabase Auth le trimite în `data`, toate opționale. */
type AuthEmailData = {
  email?: string;
  url?: string;
  token?: string;
  token_hash?: string;
  hashed_token?: string;
  new_email?: string;
  old_email?: string;
  action_type?: string;
};

type EmailSpec = { subject: string; render: (d: AuthEmailData) => React.ReactElement };

/**
 * Un singur loc pentru deciziile de email: subiect + șablon + proprietăți.
 * Cheile sunt `action_type`-urile emise de Supabase Auth.
 */
const EMAILS: Record<string, EmailSpec> = {
  signup: {
    subject: "Confirmă adresa ta de email",
    render: (d) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: d.email ?? "",
        confirmationUrl: d.url ?? SITE_URL,
      }),
  },
  invite: {
    subject: "Ai primit o invitație",
    render: (d) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: d.url ?? SITE_URL,
      }),
  },
  magiclink: {
    subject: "Linkul tău de autentificare",
    render: (d) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: d.url ?? SITE_URL,
      }),
  },
  recovery: {
    subject: "Resetează-ți parola",
    render: (d) => {
      // Recovery se deschide direct pe Suzeta; clientul consumă token-ul
      // one-time, fără a expune domeniul de infrastructură.
      const tokenHash = d.token_hash ?? d.hashed_token;
      const confirmationUrl = tokenHash
        ? `${SITE_URL}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`
        : (d.url ?? SITE_URL);
      return React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl,
      });
    },
  },
  email_change: {
    subject: "Confirmă noua adresă de email",
    render: (d) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: d.old_email ?? "",
        email: d.email ?? "",
        newEmail: d.new_email ?? "",
        confirmationUrl: d.url ?? SITE_URL,
      }),
  },
  reauthentication: {
    subject: "Codul tău de verificare",
    render: (d) => React.createElement(ReauthenticationEmail, { token: d.token ?? "" }),
  },
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        const secret = process.env["LOVABLE_WEBHOOK_SECRET"];

        // Fail-closed pe ambele: fără cheie nu putem trimite, fără secret nu
        // putem dovedi cine cere trimiterea.
        if (!apiKey) {
          console.error("[auth-email] LOVABLE_API_KEY lipsește — refuz");
          return json(500, { error: "email_not_configured" });
        }
        if (!secret) {
          console.error("[auth-email] LOVABLE_WEBHOOK_SECRET lipsește — refuz");
          return json(500, { error: "webhook_secret_not_configured" });
        }

        let payload: EmailWebhookPayload;
        try {
          const verified = await verifyWebhookRequest<EmailWebhookPayload>({
            req: request,
            secret,
          });
          payload = verified.payload;
        } catch (e) {
          // Semnătură invalidă, timestamp expirat, corp prea mare: toate
          // înseamnă „nu de la Supabase", deci 401 fără detalii pentru apelant.
          const code = e instanceof WebhookError ? e.code : "unknown";
          console.warn("[auth-email] verificare eșuată:", code);
          return json(401, { error: "invalid_signature" });
        }

        const data = (payload.data ?? {}) as AuthEmailData;
        const actionType = data.action_type ?? payload.type;
        const spec = actionType ? EMAILS[actionType] : undefined;

        if (!spec) {
          // Un tip necunoscut nu este o eroare a noastră: confirmăm primirea
          // ca Supabase să nu reîncerce la nesfârșit, dar nu trimitem nimic.
          console.warn("[auth-email] tip necunoscut, ignorat:", actionType);
          return json(200, { skipped: "unknown_action_type" });
        }
        if (!data.email) {
          console.warn("[auth-email] payload fără destinatar, ignorat:", actionType);
          return json(200, { skipped: "no_recipient" });
        }

        const element = spec.render(data);
        const [html, text] = await Promise.all([
          render(element),
          render(element, { plainText: true }),
        ]);

        try {
          await sendLovableEmail(
            {
              to: data.email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: spec.subject,
              html,
              text,
              purpose: "transactional",
              label: `auth_${actionType}`,
              run_id: payload.run_id,
              // Același eveniment de auth nu trebuie livrat de două ori dacă
              // Supabase reîncearcă webhook-ul.
              idempotency_key: payload.run_id ?? crypto.randomUUID(),
            },
            { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
          );
        } catch (e) {
          // Nu logăm adresa: e dată personală. Tipul acțiunii e suficient.
          console.error(
            `[auth-email] trimitere eșuată pentru ${actionType}:`,
            e instanceof Error ? e.message : e,
          );
          // 500 → Supabase reîncearcă, iar `idempotency_key` previne dublura.
          return json(500, { error: "send_failed" });
        }

        return json(200, { sent: true });
      },
    },
  },
});
