/**
 * Proximity notifications — server gate.
 *
 * Stratul 1 (foreground) și Stratul 2 (background) apelează `recordProximityHit`
 * ÎNAINTE de a afișa orice notificare locală. Server-side enforcement pentru:
 * - punct aprobat + publicat + partener nesuspendat
 * - toggle user (proximity_notifications_enabled)
 * - consimțământ background_location (doar Strat 2)
 * - cooldown per (user, punct), plafon zilnic, ore liniștite
 *
 * NU primește coordonate. Decizia geografică se ia pe device.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HitInput = z.object({
  pointKind: z.enum(["venue", "event"]),
  pointId: z.string().uuid(),
  layer: z.enum(["foreground", "background"]).default("foreground"),
});

export type ProximityHitResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "user_disabled"
        | "background_consent_missing"
        | "not_published"
        | "partner_suspended"
        | "quiet_hours"
        | "cooldown"
        | "daily_cap"
        | "bad_kind"
        | "not_authenticated";
    };

export const recordProximityHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HitInput.parse(d))
  .handler(async ({ data, context }): Promise<ProximityHitResult> => {
    const { data: row, error } = await (context.supabase as any).rpc(
      "try_record_proximity_hit",
      { p_kind: data.pointKind, p_id: data.pointId, p_layer: data.layer },
    );
    if (error) throw new Error(error.message);
    return row as ProximityHitResult;
  });

/** User-visible cap/cooldown copy + remaining count for UI. */
export const getProximityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: settings } = await (context.supabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", "proximity_notifications")
      .maybeSingle();
    const { count } = await (context.supabase as any)
      .from("proximity_notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("sent_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    const s = (settings?.value ?? {}) as Record<string, number>;
    return {
      sentLast24h: count ?? 0,
      dailyCap: s.daily_cap_per_user ?? 8,
      cooldownHours: s.cooldown_hours ?? 24,
      quietStart: s.quiet_start_hour ?? 22,
      quietEnd: s.quiet_end_hour ?? 8,
      defaultRadiusM: s.default_radius_m ?? 2000,
      maxRadiusM: s.max_radius_m ?? 5000,
    };
  });

/** Granular toggle for proximity notifications (independent from push). */
export const setProximityEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ proximity_notifications_enabled: data.enabled })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
