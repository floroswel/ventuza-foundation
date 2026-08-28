import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Golirea cozii de notificări (`public.push_outbox`).
 *
 * DE CE EXISTĂ: push-ul de mesaj era trimis de telefonul EXPEDITORULUI, printr-un
 * apel „fire and forget" pornit după inserarea mesajului. Dacă expeditorul
 * bloca ecranul sau schimba aplicația în acele câteva sute de milisecunde —
 * adică exact ce face oricine după ce trimite un mesaj — Android suspenda
 * procesul WebView și notificarea nu mai pleca NICIODATĂ. Mesajul exista în
 * baza de date, destinatarul nu afla nimic până redeschidea aplicația.
 *
 * Acum decizia aparține bazei de date: trigger-ul de pe `messages` scrie un
 * rând în `push_outbox` în ACEEAȘI tranzacție cu mesajul. Dacă mesajul există,
 * notificarea este garantat programată. Livrarea are apoi două căi:
 *
 *   1. cale rapidă — trigger-ul cheamă acest endpoint prin `pg_net`, imediat;
 *   2. plasă de siguranță — `pg_cron` îl cheamă la fiecare minut.
 *
 * Dacă apelul rapid eșuează (deploy în curs, rețea, 5xx), cronul îl prinde în
 * mai puțin de un minut. Nicio notificare nu se pierde tăcut.
 *
 * Securitate: același Bearer intern ca restul cron-urilor
 * (`app_settings.cron_internal`), comparat timing-safe. Fără token → 401.
 * Nu întoarce PII: doar numărători.
 */

/** Câte rânduri procesăm într-o singură invocare. */
const BATCH = 100;
/** După atâtea eșecuri consecutive renunțăm — un token FCM mort nu se repară. */
const MAX_ATTEMPTS = 5;

type OutboxRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  category: string | null;
  title: string;
  body: string;
  url: string | null;
  tag: string | null;
  attempts: number;
};

export const Route = createFileRoute("/api/public/cron/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Autentificare, identică cu didit-reconcile: tokenul stă în
        // app_settings ca să fie citibil și din funcția SQL apelată de pg_cron.
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

        // 2) Rezervăm un lot. `claim_push_outbox` este SECURITY DEFINER și
        // folosește `FOR UPDATE SKIP LOCKED`, deci două invocări simultane
        // (calea rapidă + cronul) nu pot livra același rând de două ori.
        // `claim_push_outbox` este introdusă de migrația care însoțește acest
        // fișier, deci nu există încă în tipurile generate din schemă.
        const { data: claimed, error: claimErr } = await (
          supabaseAdmin.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        )("claim_push_outbox", { _limit: BATCH });
        if (claimErr) {
          console.error("[push-dispatch] claim eșuat:", claimErr.message);
          return Response.json({ error: "claim_failed" }, { status: 500 });
        }

        const rows = (claimed ?? []) as unknown as OutboxRow[];
        if (!rows.length) return Response.json({ claimed: 0, sent: 0, failed: 0, dropped: 0 });

        // Tipurile Supabase sunt generate din schemă, iar `push_outbox` este
        // introdusă de migrația care însoțește acest fișier. Până la
        // regenerarea lor, accesăm tabela printr-un client fără tipuri —
        // același tipar folosit deja în `chat.ts` pentru inserturi noi.
        const db = supabaseAdmin as unknown as {
          from: (t: string) => {
            update: (v: Record<string, unknown>) => {
              eq: (c: string, v: string) => Promise<{ error: unknown }>;
            };
          };
        };

        const { dispatchPush } = await import("@/lib/push-dispatch.server");

        let sent = 0;
        let failed = 0;
        let dropped = 0;

        for (const row of rows) {
          try {
            const result = await dispatchPush({
              actorId: row.actor_id ?? row.recipient_id,
              toUserId: row.recipient_id,
              title: row.title,
              body: row.body,
              url: row.url ?? undefined,
              tag: row.tag ?? undefined,
              category: (row.category ?? undefined) as never,
            });

            // `delivered === 0` cu motiv (master_off, quiet_hours, prefs
            // necunoscute, niciun device abonat) NU este un eșec: este
            // decizia corectă. Rândul se închide, nu se reîncearcă.
            await db
              .from("push_outbox")
              .update({
                status: "done",
                delivered: result.delivered,
                skipped_reason: (result as { skipped?: string }).skipped ?? null,
                processed_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            sent += result.delivered;
          } catch (e) {
            // Doar erorile NEAȘTEPTATE (rețea, 5xx de la FCM) se reîncearcă.
            const attempts = row.attempts + 1;
            const giveUp = attempts >= MAX_ATTEMPTS;
            if (giveUp) dropped++;
            else failed++;
            await db
              .from("push_outbox")
              .update({
                status: giveUp ? "dead" : "pending",
                attempts,
                last_error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
                processed_at: giveUp ? new Date().toISOString() : null,
              })
              .eq("id", row.id);
          }
        }

        return Response.json({ claimed: rows.length, sent, failed, dropped });
      },
    },
  },
});
