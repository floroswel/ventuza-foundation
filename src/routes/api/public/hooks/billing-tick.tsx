/**
 * Cron endpoint: rulează zilnic `billing_tick` (generează facturi recurente,
 * marchează overdue, retrogradează grace expirat la Free).
 *
 * Autentificare: header `x-cron-secret` cu valoarea secretului server
 * `CRON_SHARED_SECRET`. Cheia anon publică NU este un secret și nu mai este
 * acceptată. Fail-closed: fără secret configurat, endpointul refuză.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/billing-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SHARED_SECRET;
        if (!expected) {
          console.error("billing-tick: CRON_SHARED_SECRET missing");
          return new Response(JSON.stringify({ error: "not_configured" }), { status: 503 });
        }
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!provided || !timingSafeEqual(provided, expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        );
        const { data, error } = await supabase.rpc("billing_tick");
        if (error) {
          console.error("billing_tick failed:", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }
        return Response.json({ ok: true, result: data, at: new Date().toISOString() });
      },
    },
  },
});
