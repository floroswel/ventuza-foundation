/**
 * Admin grants — „ce pot oferi" din admin: Premium comp, credit wallet,
 * XP, insigne, Boost, plan de partener gratuit, discount pe factură.
 *
 * RBAC: `admin` sau `super_admin` + MFA obligatoriu (acțiuni cu efect
 * economic). Fiecare acordare este scrisă în `admin_grants` ȘI în
 * `admin_audit_log` de către RPC-ul SECURITY DEFINER `admin_grant_perk`
 * (grant EXECUTE exclusiv `service_role`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminMfa } from "@/lib/admin-mfa-guard";

async function assertAdmin(sb: any, uid: string) {
  const { data } = await sb.rpc("has_any_role", {
    _user_id: uid,
    _roles: ["admin", "super_admin"],
  });
  if (!data) throw new Error("Forbidden: rol admin/super_admin necesar.");
}

async function assertStaff(sb: any, uid: string) {
  const { data } = await sb.rpc("is_staff", { _user_id: uid });
  if (!data) throw new Error("Forbidden: rol de staff necesar.");
}

export const GRANT_KINDS = [
  "premium_days",
  "wallet_credit",
  "xp",
  "badge",
  "boost_days",
  "boosts_balance",
  "partner_plan_days",
  "invoice_discount",
] as const;

const GrantInput = z.object({
  userId: z.string().uuid(),
  kind: z.enum(GRANT_KINDS),
  reason: z.string().min(5).max(500),
  days: z.number().int().positive().max(3650).nullable().optional(),
  amountCents: z.number().int().positive().max(100000).nullable().optional(),
  xp: z.number().int().positive().max(100000).nullable().optional(),
  code: z.string().min(1).max(64).nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  percent: z.number().positive().max(100).nullable().optional(),
});

export const adminGrantPerk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await (supabaseAdmin as any).rpc("admin_grant_perk", {
      _target: data.userId,
      _kind: data.kind,
      _reason: data.reason,
      _days: data.days ?? null,
      _amount_cents: data.amountCents ?? null,
      _xp: data.xp ?? null,
      _code: data.code ?? null,
      _invoice_id: data.invoiceId ?? null,
      _percent: data.percent ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, result: res };
  });

const ListInput = z.object({
  userId: z.string().uuid().nullable().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export const adminListGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_grants", {
      _target: data.userId ?? null,
      _limit: data.limit ?? 50,
    });
    if (error) throw new Error(error.message);
    return { grants: (rows ?? []) as Array<Record<string, any>> };
  });

/** Catalog pentru dropdown-uri: planuri partener + badge-uri manuale. */
export const adminGrantCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [plans, badges] = await Promise.all([
      context.supabase.from("partner_plans").select("code,name").eq("active", true).order("sort_order"),
      context.supabase
        .from("badge_registry")
        .select("code,icon")
        .eq("is_manual", true)
        .eq("is_active", true)
        .order("priority", { ascending: false }),
    ]);
    return {
      plans: (plans.data ?? []) as Array<{ code: string; name: string | null }>,
      badges: (badges.data ?? []) as Array<{ code: string; icon: string | null }>,
    };
  });

/** Rolul de staff al contului curent — pentru insigna din propriul profil. */
export const getMyStaffRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("admin_get_my_role");
    if (error) return { role: null as string | null };
    const role = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    return { role: (typeof role === "string" ? role : (role?.role ?? null)) as string | null };
  });
