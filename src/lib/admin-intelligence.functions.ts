// CEO-level intelligence: MRR, Retention, Funnel, Kill switches, Force-update
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(sb: any, userId: string) {
  const { data } = await sb.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}
async function assertAdmin(sb: any, userId: string) {
  const { data } = await sb.rpc("is_admin_or_above", { _user_id: userId });
  if (!data) throw new Error("Forbidden: admin required");
}

export const getRevenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("admin_revenue_stats");
    if (error) throw new Error(error.message);
    return data;
  });

export const getRetentionCohorts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(7).max(90).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_retention_cohorts", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getFunnelStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: v, error } = await context.supabase.rpc("admin_funnel_stats", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return v;
  });

/* ---------------- KILL SWITCHES ---------------- */
const KILL_KEYS = ["chat", "matching", "uploads", "discover", "signup", "partner_portal"] as const;
type KillKey = (typeof KILL_KEYS)[number];

export const getKillSwitches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "kill_switches")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const v = (data?.value ?? {}) as Record<string, boolean>;
    const out: Record<KillKey, boolean> = {} as any;
    for (const k of KILL_KEYS) out[k] = !!v[k];
    return out;
  });

export const setKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.enum(KILL_KEYS),
        on: z.boolean(),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: cur } = await sa
      .from("app_settings")
      .select("value")
      .eq("key", "kill_switches")
      .maybeSingle();
    const next = { ...(cur?.value ?? {}), [data.key]: data.on };
    const { error } = await sa.rpc("admin_update_setting", {
      _key: "kill_switches",
      _value: next,
      _reason: data.reason,
    });
    if (error) {
      // fallback: direct update + audit
      await sa.from("app_settings").update({ value: next }).eq("key", "kill_switches");
      await sa.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: `killswitch_${data.on ? "on" : "off"}`,
        target_table: "app_settings",
        target_id: "kill_switches",
        justification: data.reason,
        after_data: next,
        severity: data.on ? "critical" : "warning",
      });
    }
    return { ok: true, killSwitches: next };
  });

/* ---------------- MIN SUPPORTED VERSION ---------------- */
export const getMinVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "min_supported_version")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data?.value ?? { web: "0.0.0", ios: "0.0.0", android: "0.0.0", force_update_message: "" }
    );
  });

export const setMinVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        web: z.string().regex(/^\d+\.\d+\.\d+$/),
        ios: z.string().regex(/^\d+\.\d+\.\d+$/),
        android: z.string().regex(/^\d+\.\d+\.\d+$/),
        force_update_message: z.string().max(280),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const value = {
      web: data.web,
      ios: data.ios,
      android: data.android,
      force_update_message: data.force_update_message,
    };
    await sa.from("app_settings").update({ value }).eq("key", "min_supported_version");
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "min_version_set",
      target_table: "app_settings",
      target_id: "min_supported_version",
      justification: data.reason,
      after_data: value,
      severity: "warning",
    });
    return { ok: true, value };
  });
