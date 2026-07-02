/**
 * Admin Users — enhanced ops (search + KPIs + bulk).
 *
 * Toate funcțiile respectă REGULĂ ADMIN:
 * - gated `is_admin_or_above` sau `is_staff` server-side (nu doar UI).
 * - Fiecare mutație scrie în `admin_audit_log` cu justificare + before/after.
 * - MFA obligatoriu pentru acțiuni distructive (`assertAdminMfa`).
 * - Nu se returnează date sensibile (locație precisă, HIV, mesaje brute).
 *   Doar câmpuri operaționale de profil.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin_or_above", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}
async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

async function getReqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
  try { ua = getRequestHeader("user-agent") ?? null; } catch {}
  return { ip, ua };
}

async function logAudit(opts: {
  actorId: string; action: string;
  targetTable?: string | null; targetId?: string | null;
  before?: any; after?: any; justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ip, ua } = await getReqMeta();
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId,
    action: opts.action,
    target_table: opts.targetTable ?? null,
    target_id: opts.targetId ?? null,
    before_data: opts.before ?? null,
    after_data: opts.after ?? null,
    justification: opts.justification ?? null,
    severity: opts.severity ?? "info",
    ip, user_agent: ua,
  });
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/* ============================================================
 * KPI TILES — headline metrics pentru pagina Users.
 * ============================================================ */
export const adminUserQuickStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;

    const nowIso = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    async function count(build: (q: any) => any) {
      let q = sa.from("profiles").select("id", { count: "exact", head: true });
      q = build(q);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    }

    const [total, newDay, active7d, banned, suspended, pendingAge, highRisk, deleted] = await Promise.all([
      count((q) => q.is("deleted_at", null)),
      count((q) => q.is("deleted_at", null).gte("created_at", dayAgo)),
      count((q) => q.is("deleted_at", null).gte("last_seen", weekAgo)),
      count((q) => q.not("banned_at", "is", null)),
      count((q) => q.gt("suspended_until", nowIso)),
      count((q) => q.is("deleted_at", null).neq("age_status", "verified")),
      count((q) => q.gte("risk_score", 70)),
      count((q) => q.not("deleted_at", "is", null)),
    ]);

    return { total, newDay, active7d, banned, suspended, pendingAge, highRisk, deleted };
  });

/* ============================================================
 * ENHANCED SEARCH — filtre + sort + fields extinse.
 * ============================================================ */
const SearchInput = z.object({
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  status: z.enum(["any", "active", "banned", "suspended", "shadow"]).optional(),
  role: z.enum(["any", "admin", "moderator", "business", "super_admin", "auditor", "support"]).optional(),
  verified: z.enum(["any", "verified", "unverified"]).optional(),
  hasReports: z.boolean().optional(),
  createdSince: z.string().optional(), // ISO
  sort: z.enum(["created_desc", "created_asc", "last_seen_desc", "reports_desc", "risk_desc", "xp_desc"]).optional(),
});

export const adminSearchUsersV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const limit = data.limit ?? 100;
    const nowIso = new Date().toISOString();

    let q: any = sa
      .from("profiles")
      .select("id, display_name, travel_city, verified, banned_at, suspended_until, report_count, level, xp, created_at, last_seen, age_status, risk_score, deleted_at, photos, partner_suspended_at");

    // Sort
    switch (data.sort ?? "created_desc") {
      case "created_asc": q = q.order("created_at", { ascending: true }); break;
      case "last_seen_desc": q = q.order("last_seen", { ascending: false, nullsFirst: false }); break;
      case "reports_desc": q = q.order("report_count", { ascending: false, nullsFirst: false }); break;
      case "risk_desc": q = q.order("risk_score", { ascending: false, nullsFirst: false }); break;
      case "xp_desc": q = q.order("xp", { ascending: false, nullsFirst: false }); break;
      default: q = q.order("created_at", { ascending: false });
    }
    q = q.limit(limit);

    // Status filter
    switch (data.status) {
      case "active":
        q = q.is("banned_at", null).is("deleted_at", null);
        // suspended_until NULL sau trecut
        q = q.or(`suspended_until.is.null,suspended_until.lte.${nowIso}`);
        break;
      case "banned":
        q = q.not("banned_at", "is", null);
        break;
      case "suspended":
        q = q.gt("suspended_until", nowIso);
        break;
      case "shadow":
        // best-effort — coloană poate lipsi; se ignoră dacă nu există.
        q = q.eq("shadowbanned", true);
        break;
    }

    // Verified filter
    if (data.verified === "verified") q = q.eq("verified", true);
    if (data.verified === "unverified") q = q.eq("verified", false);

    // Reports filter
    if (data.hasReports) q = q.gt("report_count", 0);

    // Created since
    if (data.createdSince) q = q.gte("created_at", data.createdSince);

    // Search text
    if (data.q) {
      const s = data.q.trim();
      if (isUuid(s)) {
        q = q.eq("id", s);
      } else {
        const esc = s.replace(/[,%()]/g, " ");
        q = q.or(`display_name.ilike.%${esc}%,travel_city.ilike.%${esc}%`);
      }
    }

    const { data: rows, error } = await q;
    if (error) {
      // shadowbanned column optional: fallback
      if (/shadowbanned/i.test(error.message) && data.status === "shadow") {
        return [];
      }
      throw new Error(error.message);
    }

    // Roles (batch)
    const ids = (rows ?? []).map((r: any) => r.id);
    let rolesByUser: Record<string, string[]> = {};
    if (ids.length) {
      const { data: roles } = await sa.from("user_roles").select("user_id, role").in("user_id", ids);
      (roles ?? []).forEach((r: any) => {
        rolesByUser[r.user_id] = rolesByUser[r.user_id] ?? [];
        rolesByUser[r.user_id].push(r.role);
      });
    }

    let out = (rows ?? []).map((r: any) => ({
      ...r,
      thumb: Array.isArray(r.photos) && r.photos.length ? r.photos[0] : null,
      photos: undefined,
      roles: rolesByUser[r.id] ?? [],
    }));

    // Role filter (post-fetch pentru simplitate — nu impact la limit=200)
    if (data.role && data.role !== "any") {
      out = out.filter((r: any) => r.roles.includes(data.role));
    }

    return out;
  });

/* ============================================================
 * BULK ACTIONS — ban/unban/suspend/verify pentru selecție.
 * ============================================================ */
const BulkInput = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["ban", "unban", "suspend", "verify", "unverify"]),
  hours: z.number().int().min(1).max(8760).optional(),
  reason: z.string().min(10).max(500),
});

export const adminBulkUserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);

    // MFA obligatoriu pentru toate acțiunile distructive
    if (data.action === "ban" || data.action === "unban" || data.action === "suspend") {
      const { assertAdminMfa } = await import("./admin-mfa-guard");
      await assertAdminMfa(context.userId);
    }

    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;

    // Nu te poți ban/suspenda pe tine
    if (data.action === "ban" || data.action === "suspend") {
      if (data.userIds.includes(context.userId)) {
        throw new Error("Nu poți executa această acțiune pe contul tău.");
      }
    }

    let ok = 0, failed = 0;
    const errors: Array<{ id: string; msg: string }> = [];

    for (const id of data.userIds) {
      let patch: any = null;
      let action = "";
      let severity: "info" | "warning" | "critical" = "info";
      switch (data.action) {
        case "ban":
          patch = { banned_at: new Date().toISOString(), banned_reason: data.reason };
          action = "user.ban"; severity = "critical";
          break;
        case "unban":
          patch = { banned_at: null, banned_reason: null };
          action = "user.unban"; severity = "warning";
          break;
        case "suspend": {
          const until = new Date(Date.now() + (data.hours ?? 24) * 3600 * 1000).toISOString();
          patch = { suspended_until: until };
          action = "user.suspend"; severity = "warning";
          break;
        }
        case "verify":
          patch = { verified: true };
          action = "user.verify"; severity = "info";
          break;
        case "unverify":
          patch = { verified: false };
          action = "user.unverify"; severity = "warning";
          break;
      }

      const { data: before } = await sa
        .from("profiles")
        .select("banned_at, banned_reason, suspended_until, verified")
        .eq("id", id)
        .maybeSingle();

      const { error } = await sa.from("profiles").update(patch).eq("id", id);
      if (error) {
        failed++;
        errors.push({ id, msg: error.message });
        continue;
      }
      ok++;
      await logAudit({
        actorId: context.userId, action,
        targetTable: "profiles", targetId: id,
        before, after: patch,
        justification: `[bulk ${data.userIds.length}] ${data.reason}`,
        severity,
      });
    }

    return { ok, failed, total: data.userIds.length, errors: errors.slice(0, 5) };
  });
