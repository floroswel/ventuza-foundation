/**
 * Cron endpoint: rulează zilnic `billing_tick` (generează facturi recurente,
 * marchează overdue, retrogradează grace expirat la Free).
 *
 * Apelat de pg_cron cu `apikey: <anon>` header.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/billing-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apikey || apikey !== expected) {
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
