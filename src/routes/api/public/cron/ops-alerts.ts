import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/**
 * Alertare minimă (apelată de pg_cron la 10 minute prin `cron_ops_health_alerts`).
 *
 * Trei semnale, atât. Nu este un sistem de monitorizare — scopul este să aflăm
 * înaintea utilizatorilor când ceva cedează tăcut:
 *   1. push_outbox: > 50 rânduri `pending` mai vechi de 10 minute
 *   2. net._http_response: coduri != 200 în ultima oră pentru URL-uri suzeta.app
 *   3. /api/public/signup-guard răspunde `degraded: true`
 *
 * Anti-zgomot: maximum un email pe zi per tip de alertă, garantat în DB prin
 * `ops_try_record_alert` (dedupe în cod ar ceda la două rulări simultane).
 *
 * Securitate: Bearer token intern din `app_settings.cron_internal`, comparat
 * timing-safe. Fără token valid → 401. Emailul nu conține date de utilizator.
 */

const PUSH_PENDING_THRESHOLD = 50;

type AlertKind = "push_stalled" | "internal_http_failing" | "signup_guard_degraded";

interface Alert {
  kind: AlertKind;
  title: string;
  summary: string;
  details: string;
}

export const Route = createFileRoute("/api/public/cron/ops-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Autentificare cron — aceeași sursă de adevăr ca funcția SQL.
        const { data: cfg, error: cfgError } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "cron_internal")
          .maybeSingle();
        const expected = (cfg?.value as { token?: string } | null)?.token ?? "";
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (cfgError || !expected || a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const alerts: Alert[] = [];

        // 2) Semnalele 1 și 2 — citite din DB printr-un singur RPC.
        const { data: signals, error: signalsError } = await supabaseAdmin.rpc("ops_health_signals");
        if (signalsError) {
          console.error("[ops-alerts] ops_health_signals failed", signalsError.message);
        } else {
          const s = (signals ?? {}) as {
            push_pending_over_10min?: number;
            http_failures_last_hour?: number;
            http_failure_sample?: Array<{ status_code?: number; url?: string; error_msg?: string }>;
          };

          const pending = s.push_pending_over_10min ?? 0;
          if (pending > PUSH_PENDING_THRESHOLD) {
            alerts.push({
              kind: "push_stalled",
              title: "Livrarea notificărilor s-a oprit",
              summary:
                `${pending} notificări așteaptă de peste 10 minute în coada de trimitere. ` +
                "Probabil dispecerul (cron-ul push-dispatch) nu mai rulează sau eșuează.",
              details: `push_outbox pending > 10 min: ${pending} (prag: ${PUSH_PENDING_THRESHOLD})`,
            });
          }

          const httpFailures = s.http_failures_last_hour ?? 0;
          if (httpFailures > 0) {
            const sample = (s.http_failure_sample ?? [])
              .map((r) => `${r.status_code ?? "?"} ${r.url ?? ""} ${r.error_msg ?? ""}`.trim())
              .join("\n");
            alerts.push({
              kind: "internal_http_failing",
              title: "Apelurile interne sunt respinse",
              summary:
                `${httpFailures} apeluri către suzeta.app pornite din baza de date au primit ` +
                "alt cod decât 200 în ultima oră. Cron-urile interne nu își fac treaba.",
              details: `răspunsuri != 200 (1h): ${httpFailures}\n${sample}`,
            });
          }
        }

        // 3) Semnalul 3 — se poate măsura doar chemând ruta.
        try {
          const origin = new URL(request.url).origin;
          const res = await fetch(`${origin}/api/public/signup-guard`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: "ops-health-probe-0001" }),
          });
          const payload = (await res.json().catch(() => ({}))) as { degraded?: boolean; reason?: string };
          if (payload.degraded === true) {
            alerts.push({
              kind: "signup_guard_degraded",
              title: "Protecția anti-bot la înscriere nu rulează",
              summary:
                "Ruta /api/public/signup-guard răspunde `degraded: true` — înscrierile trec " +
                "nefiltrate (fail-open deliberat), deci boții nu sunt opriți.",
              details: `degraded: true\nmotiv: ${payload.reason ?? "necunoscut"}\nhttp: ${res.status}`,
            });
          }
        } catch (err) {
          console.error("[ops-alerts] signup-guard probe failed", err instanceof Error ? err.message : err);
        }

        // 4) Trimitem cel mult un email pe zi per tip. Dedupe-ul stă în DB.
        const recipient = await resolveRecipient(supabaseAdmin);
        const sent: AlertKind[] = [];
        const suppressed: AlertKind[] = [];

        for (const alert of alerts) {
          const { data: shouldSend, error: dedupeError } = await supabaseAdmin.rpc("ops_try_record_alert", {
            _kind: alert.kind,
            _details: { title: alert.title },
          });
          if (dedupeError) {
            console.error("[ops-alerts] dedupe failed", dedupeError.message);
            continue;
          }
          if (!shouldSend) {
            suppressed.push(alert.kind);
            continue;
          }
          try {
            await sendTemplateEmail("ops-alert", recipient, {
              templateData: { title: alert.title, summary: alert.summary, details: alert.details },
              idempotencyKey: `ops-alert-${alert.kind}-${new Date().toISOString().slice(0, 10)}`,
            });
            sent.push(alert.kind);
          } catch (err) {
            console.error("[ops-alerts] email failed", err instanceof Error ? err.message : err);
          }
        }

        return Response.json(
          { ok: true, detected: alerts.map((x) => x.kind), sent, suppressed },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

async function resolveRecipient(
  supabaseAdmin: { from: (t: string) => any },
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "ops_alerts")
    .maybeSingle();
  return (data?.value as { email?: string } | null)?.email || "support@suzeta.ro";
}
