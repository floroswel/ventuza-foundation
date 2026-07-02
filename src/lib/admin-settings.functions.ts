/**
 * MODUL 2 — Settings & Flags (server fns).
 *
 * Sursa autoritativă pentru parametri runtime: `public.app_settings`
 * + `public.feature_flags`. Modificare DOAR prin:
 *   - `admin_update_setting` (versionat + istoric în `app_settings_history`)
 *   - upsert pe `feature_flags`
 * cu justification ≥ 10 + audit log + MFA + RBAC (admin/super_admin).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function reqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    /* noop */
  }
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {
    /* noop */
  }
  return { ip, ua };
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "super_admin"],
  });
  if (!data) throw new Error("Forbidden: rol admin/super_admin necesar");
}

export const adminListSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("app_settings").select("*").order("category");
    return { rows: (data ?? []) as any[] };
  });

const SetInput = z.object({
  key: z.string().min(1).max(120),
  value: z.any(),
  justification: z.string().trim().min(10).max(500),
});

export const adminUpdateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: before } = await sa
      .from("app_settings")
      .select("value, version")
      .eq("key", data.key)
      .maybeSingle();
    const { data: r, error } = await sa.rpc("admin_update_setting", {
      _key: data.key,
      _value: data.value,
      _actor: context.userId,
    });
    if (error) throw new Error(error.message);
    const meta = await reqMeta();
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "settings.update",
      target_table: "app_settings",
      target_id: data.key,
      before_data: before ?? null,
      after_data: { value: data.value },
      justification: data.justification,
      severity: "info",
      ip: meta.ip,
      user_agent: meta.ua,
    });
    return r as any;
  });

export const adminSettingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("app_settings_history")
      .select("*")
      .eq("key", data.key)
      .order("version", { ascending: false })
      .limit(50);
    return { rows: (rows ?? []) as any[] };
  });

export const adminListFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("feature_flags").select("*").order("key");
    return { rows: (data ?? []) as any[] };
  });

const FlagInput = z.object({
  key: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  rollout_pct: z.number().int().min(0).max(100).optional(),
  segment: z.record(z.any()).optional(),
  description: z.string().max(500).optional(),
  justification: z.string().trim().min(10).max(500),
});

export const adminUpsertFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FlagInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: before } = await sa
      .from("feature_flags")
      .select("*")
      .eq("key", data.key)
      .maybeSingle();
    const patch: any = { updated_by: context.userId, updated_at: new Date().toISOString() };
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.rollout_pct !== undefined) patch.rollout_pct = data.rollout_pct;
    if (data.segment !== undefined) patch.segment = data.segment;
    if (data.description !== undefined) patch.description = data.description;
    const { error } = await sa.from("feature_flags").upsert({ key: data.key, ...patch });
    if (error) throw new Error(error.message);
    const meta = await reqMeta();
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "feature_flag.upsert",
      target_table: "feature_flags",
      target_id: data.key,
      before_data: before ?? null,
      after_data: patch,
      justification: data.justification,
      severity: "info",
      ip: meta.ip,
      user_agent: meta.ua,
    });
    return { ok: true as const };
  });

/** RPC helper UI: cel mai înalt rol al callerului (pentru gate-uri client). */
export const adminGetMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("admin_get_my_role");
    return { role: (data ?? null) as string | null };
  });
