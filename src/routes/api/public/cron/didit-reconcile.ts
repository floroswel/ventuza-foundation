import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { syncDiditStatusForUser } from "@/lib/didit-status.server";
import {
  pickDiditReconcileUserIds,
  DIDIT_REconcile_MAX_USERS,
} from "@/lib/didit-reconcile";

/**
 * Cron de reconciliere Didit (apelat de pg_cron la 15 minute).
 *
 * Problema: dacă webhook-ul Didit nu ajunge (rețea, deploy, eroare tranzitorie),
 * contul rămâne blocat în `age_status='pending'` definitiv. Acest endpoint
 * re-interoghează Didit (`diditFetchDecision` prin `syncDiditStatusForUser`)
 * pentru toate sesiunile nerezolvate mai vechi de 1 oră — zero conturi blocate.
 *
 * Securitate: Bearer token intern din `app_settings.cron_internal`
 * (comparare timing-safe). Fără token valid → 401. Nu returnează PII.
 */
export const Route = createFileRoute("/api/public/cron/didit-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Autentificare cron: token intern din app_settings (nu env, ca să
        // poată fi citit și de funcția SQL pg_cron din aceeași sursă).
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

        // 2) Sesiuni candidate: nerezolvate, nu mai vechi de 7 zile.
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: sessions, error } = await supabaseAdmin
          .from("didit_sessions")
          .select("user_id, session_id, resolved_at, created_at")
          .is("resolved_at", null)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(500);
        if (error) {
          console.error("[didit-reconcile] query failed", error.message);
          return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
        }

        const userIds = pickDiditReconcileUserIds(sessions ?? []);

        // 3) Re-interoghează Didit pentru fiecare user (sequențial — max 50,
        // ca să rămânem în bugetul de timp al workerului).
        let synced = 0;
        let failed = 0;
        for (const userId of userIds) {
          try {
            const res = await syncDiditStatusForUser(supabaseAdmin, userId);
            if (res.ok) synced += 1;
            else failed += 1;
          } catch (err) {
            failed += 1;
            console.error("[didit-reconcile] sync failed for user", err instanceof Error ? err.message : err);
          }
        }

        return Response.json(
          { ok: true, candidates: (sessions ?? []).length, users: userIds.length, synced, failed, cap: DIDIT_REconcile_MAX_USERS },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
