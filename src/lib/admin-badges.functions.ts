/**
 * Admin badge grants — acordare / revocare badge-uri manuale
 * (fondator, ONG, bar, aliat, presă, etc.).
 *
 * RBAC: `admin` sau `super_admin`. Toate acțiunile audit `critical` + MFA.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminMfa } from "@/lib/admin-mfa-guard";

async function assertAdmin(sb: any, uid: string) {
  const { data } = await sb.rpc("has_any_role", { _user_id: uid, _roles: ["admin", "super_admin"] });
  if (!data) throw new Error("Forbidden: rol admin/super_admin necesar.");
}

/* ---------- LIST manual badge catalog ---------- */
export const adminListManualBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("badge_registry")
      .select("code,label_i18n,icon,color_class,effect,default_permanent,criteria_summary,priority")
      .eq("is_manual", true)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    return { badges: data ?? [] };
  });

/* ---------- LIST grants for one user ---------- */
const ListGrantsInput = z.object({ userId: z.string().uuid() });
export const adminListUserBadgeGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListGrantsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("user_badge_grants")
      .select("id,badge_code,granted_by,granted_at,expires_at,reason,revoked_at,revoked_by,revoke_reason")
      .eq("user_id", data.userId)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { grants: rows ?? [] };
  });

/* ---------- GRANT ---------- */
const GrantInput = z.object({
  userId: z.string().uuid(),
  code: z.string().min(1).max(64),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().min(10).max(500),
});
export const adminGrantBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { error } = await context.supabase.rpc("admin_grant_badge", {
      _target: data.userId,
      _code: data.code,
      _expires_at: data.expiresAt ?? null,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- REVOKE ---------- */
const RevokeInput = z.object({
  userId: z.string().uuid(),
  code: z.string().min(1).max(64),
  reason: z.string().min(10).max(500),
});
export const adminRevokeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { error } = await context.supabase.rpc("admin_revoke_badge", {
      _target: data.userId,
      _code: data.code,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
