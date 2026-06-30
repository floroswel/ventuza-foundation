/**
 * MODUL 3 — Staff management (roles + IP allowlist + MFA status).
 *
 * Reguli AGENTS.md:
 *  - RBAC server-side (admin/super_admin pentru roluri; super_admin pentru
 *    grant/revoke `admin`/`super_admin` și pentru IP allowlist).
 *  - `assertAdminMfa` pe orice mutație.
 *  - Justification ≥ 10 → `admin_audit_log` (before→after).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole =
  | "super_admin" | "admin" | "auditor" | "moderator" | "support" | "read_only"
  | "business";

const STAFF_ROLES: AppRole[] = [
  "super_admin", "admin", "auditor", "moderator", "support", "read_only",
];

async function reqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
  try { ua = getRequestHeader("user-agent") ?? null; } catch {}
  return { ip, ua };
}

async function assertRole(
  supabase: any, userId: string, roles: AppRole[],
) {
  const { data, error } = await supabase.rpc("has_any_role", { _user_id: userId, _roles: roles });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: rol insuficient");
}

async function isSuper(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  return !!data;
}

async function logAudit(opts: {
  actorId: string; action: string;
  targetTable?: string | null; targetId?: string | null;
  before?: any; after?: any; justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const meta = await reqMeta();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId, action: opts.action,
    target_table: opts.targetTable ?? null, target_id: opts.targetId ?? null,
    before_data: opts.before ?? null, after_data: opts.after ?? null,
    justification: opts.justification ?? null,
    severity: opts.severity ?? "info",
    ip: meta.ip, user_agent: meta.ua,
  });
}

/* ============================================================
 * LIST STAFF (toți userii cu cel puțin un rol din STAFF_ROLES)
 * ============================================================ */
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId,
      ["super_admin", "admin", "auditor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const { data: roles, error } = await sa.from("user_roles")
      .select("user_id, role")
      .in("role", STAFF_ROLES);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))) as string[];
    if (!ids.length) return { rows: [] };

    const [profilesRes, mfaRes, authRes] = await Promise.all([
      sa.from("profiles").select("id, display_name, created_at").in("id", ids),
      sa.from("admin_mfa_status").select("user_id, enrolled, enrolled_at, last_verified_at").in("user_id", ids),
      Promise.all(ids.map((id) => sa.auth.admin.getUserById(id).catch(() => null))),
    ]);
    const profileById = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const mfaById = new Map((mfaRes.data ?? []).map((m: any) => [m.user_id, m]));
    const emailById = new Map<string, string | null>();
    (authRes ?? []).forEach((r: any, idx: number) => {
      emailById.set(ids[idx], r?.data?.user?.email ?? null);
    });
    const rolesByUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      (rolesByUser[r.user_id] ??= []).push(r.role);
    });

    const rows = ids.map((id) => {
      const p: any = profileById.get(id) ?? {};
      const m: any = mfaById.get(id);
      return {
        user_id: id,
        display_name: p.display_name ?? null,
        email: emailById.get(id) ?? null,
        roles: rolesByUser[id] ?? [],
        mfa_enrolled: !!m?.enrolled,
        mfa_enrolled_at: m?.enrolled_at ?? null,
        mfa_last_verified_at: m?.last_verified_at ?? null,
        profile_created_at: p.created_at ?? null,
      };
    }).sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
    return { rows };
  });

/* ============================================================
 * GRANT / REVOKE STAFF ROLE (with justification + MFA)
 * ============================================================ */
const StaffRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(STAFF_ROLES as [AppRole, ...AppRole[]]),
  justification: z.string().trim().min(10).max(500),
});

export const adminGrantStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StaffRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    // Acordarea oricărui rol de staff = privilegiu admin/super_admin.
    await assertRole(context.supabase, context.userId, ["admin", "super_admin"]);
    // Doar super_admin poate acorda admin sau super_admin.
    if (data.role === "admin" || data.role === "super_admin") {
      if (!(await isSuper(context.supabase, context.userId))) {
        throw new Error("Forbidden: doar super_admin poate acorda admin/super_admin");
      }
    }
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { error } = await sa.from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: "staff.role_grant",
      targetTable: "user_roles", targetId: data.userId,
      after: { role: data.role },
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const };
  });

export const adminRevokeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StaffRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["admin", "super_admin"]);
    if (data.role === "admin" || data.role === "super_admin") {
      if (!(await isSuper(context.supabase, context.userId))) {
        throw new Error("Forbidden: doar super_admin poate revoca admin/super_admin");
      }
    }
    if (data.role === "super_admin" && data.userId === context.userId) {
      throw new Error("Refuz: nu îți poți revoca propriul super_admin (lockout).");
    }
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { error } = await sa.from("user_roles")
      .delete().eq("user_id", data.userId).eq("role", data.role);
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: "staff.role_revoke",
      targetTable: "user_roles", targetId: data.userId,
      before: { role: data.role },
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const };
  });

/* ============================================================
 * IP ALLOWLIST (DOAR super_admin)
 * Tabela: public.admin_ip_allowlist (cidr text, label, created_by, created_at)
 * ============================================================ */
export const adminListIpAllowlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId,
      ["super_admin", "admin", "auditor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("admin_ip_allowlist").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });

const IpInput = z.object({
  cidr: z.string().trim().min(7).max(64)
    // IPv4/IPv6 + optional CIDR suffix — validare laxă, INET refuză restul.
    .regex(/^[0-9a-fA-F:.]+(\/\d{1,3})?$/, "CIDR invalid"),
  label: z.string().trim().max(120).optional(),
  justification: z.string().trim().min(10).max(500),
});

export const adminAddIpAllowlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IpInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isSuper(context.supabase, context.userId))) {
      throw new Error("Forbidden: doar super_admin");
    }
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: row, error } = await sa.from("admin_ip_allowlist")
      .insert({ cidr: data.cidr, label: data.label ?? null, created_by: context.userId })
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: "staff.ip_allowlist_add",
      targetTable: "admin_ip_allowlist", targetId: row?.id ?? null,
      after: { cidr: data.cidr, label: data.label ?? null },
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const, id: row?.id };
  });

export const adminRemoveIpAllowlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    justification: z.string().trim().min(10).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isSuper(context.supabase, context.userId))) {
      throw new Error("Forbidden: doar super_admin");
    }
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: before } = await sa.from("admin_ip_allowlist").select("*").eq("id", data.id).maybeSingle();
    const { error } = await sa.from("admin_ip_allowlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId, action: "staff.ip_allowlist_remove",
      targetTable: "admin_ip_allowlist", targetId: data.id,
      before: before ?? null,
      justification: data.justification, severity: "critical",
    });
    return { ok: true as const };
  });
