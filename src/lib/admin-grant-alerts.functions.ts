/**
 * Alerte de abuz pe acordări/compensații (admin_grants).
 * Praguri configurabile în `app_settings.grant_abuse_thresholds` (AGENTS.md —
 * niciun parametru de business hardcodat). Citire gated pe `is_staff` în SQL.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GrantAbuseAlert = {
  code: string;
  severity: string;
  actor_id: string | null;
  target_user_id: string | null;
  observed: number;
  threshold: number;
  message: string;
  last_at: string | null;
};

export const adminGetGrantAbuseAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_grant_abuse_alerts", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return { alerts: (rows ?? []) as GrantAbuseAlert[] };
  });

export const adminGetGrantAbuseThresholds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "grant_abuse_thresholds")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { thresholds: (data?.value ?? {}) as Record<string, number> };
  });
