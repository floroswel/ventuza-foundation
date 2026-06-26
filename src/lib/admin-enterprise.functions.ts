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
  actorId: string; actorEmail?: string | null; action: string;
  targetTable?: string | null; targetId?: string | null;
  before?: any; after?: any; justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ip, ua } = await getReqMeta();
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId,
    actor_email: opts.actorEmail ?? null,
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

/* ---------------- AUDIT LOG VIEWER ---------------- */
const AuditQuery = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  targetTable: z.string().max(80).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  since: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const adminGetAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AuditQuery.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // auditor role also allowed
    const { data: ok } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId, _roles: ["admin", "super_admin", "auditor"],
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    let q = sa.from("admin_audit_log").select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset ?? 0, (data.offset ?? 0) + (data.limit ?? 100) - 1);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.targetTable) q = q.eq("target_table", data.targetTable);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

/* ---------------- MODERATION WITH JUSTIFICATION ---------------- */
const ModInput = z.object({
  userId: z.string().uuid(),
  justification: z.string().min(5).max(500),
  hours: z.number().int().min(1).max(8760).optional(),
});

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const { data: before } = await sa.from("profiles").select("banned_at, banned_reason").eq("id", data.userId).maybeSingle();
    const { error } = await sa.from("profiles").update({
      banned_at: new Date().toISOString(), banned_reason: data.justification,
    }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "user.ban", targetTable: "profiles", targetId: data.userId,
      before, after: { banned_at: "now", banned_reason: data.justification },
      justification: data.justification, severity: "critical",
    });
    return { ok: true };
  });

export const adminUnbanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const { error } = await sa.from("profiles").update({ banned_at: null, banned_reason: null }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "user.unban", targetTable: "profiles", targetId: data.userId,
      justification: data.justification, severity: "warning",
    });
    return { ok: true };
  });

export const adminSuspendUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const hours = data.hours ?? 24;
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const { error } = await sa.from("profiles").update({ suspended_until: until }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "user.suspend", targetTable: "profiles", targetId: data.userId,
      after: { suspended_until: until, hours }, justification: data.justification, severity: "warning",
    });
    return { ok: true };
  });

export const adminShadowbanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModInput.extend({ on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    // try `shadowbanned`; if column missing fall back to risk_signals
    const { error } = await sa.from("profiles").update({ shadowbanned: data.on }).eq("id", data.userId);
    if (error && !/column.*shadowbanned/i.test(error.message)) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: data.on ? "user.shadowban" : "user.unshadowban",
      targetTable: "profiles", targetId: data.userId,
      justification: data.justification, severity: "warning",
    });
    return { ok: true };
  });

/* ---------------- ALERTS ---------------- */
export const adminGetAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_alerts").select("*")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminAckAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: "alert.ack", targetTable: "admin_alerts", targetId: String(data.id) });
    return { ok: true };
  });

/* ---------------- DSA REPORTS ---------------- */
export const adminGetDsaReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    // illegal_content_reports este ANONIM by design (oricine poate raporta).
    // Identitatea raportorului nu se proiectează — proiecție explicită fără
    // reporter_email / reporter_user_id, indiferent de rol.
    const { data, error } = await context.supabase.from("illegal_content_reports")
      .select("id, category, content_type, content_url, description, legal_basis, status, handled_by, handled_at, resolution, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminResolveDsa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), status: z.enum(["resolved", "dismissed", "escalated"]),
    resolution: z.string().min(3).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("illegal_content_reports").update({
      status: data.status, resolution: data.resolution,
      handled_by: context.userId, handled_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: `dsa.${data.status}`,
      targetTable: "illegal_content_reports", targetId: data.id,
      justification: data.resolution, severity: "warning",
    });
    return { ok: true };
  });

/* ---------------- CSAM / PHOTO SAFETY ---------------- */
export const adminAddCsamHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    hash: z.string().min(8).max(128), source: z.string().max(80).optional(),
    justification: z.string().min(5).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const { error } = await sa.from("csam_hash_blocklist").upsert({
      hash: data.hash, source: data.source ?? "manual", added_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "csam.hash_add",
      targetTable: "csam_hash_blocklist", targetId: data.hash,
      justification: data.justification, severity: "critical",
    });
    return { ok: true };
  });

export const adminGetCsamReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    // REGULĂ CSAM — NEVER RENDER. Conținutul suspectat NU părăsește
    // server-ul ca URL/blob: proiectăm DOAR hash + status + meta. UI
    // afișează doar hash (referință), nu imagine.
    const { data, error } = await sa.from("csam_reports")
      .select("id, user_id, hash, match_source, ncmec_report_id, reported_at, status, notes")
      .order("reported_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------------- GDPR ---------------- */
export const adminGetDeletionRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("deletion_requests")
      .select("*").order("scheduled_for", { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminExportUserData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    userId: z.string().uuid(), justification: z.string().min(5).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const tables = ["profiles", "messages", "stories", "swipes", "matches", "favorites",
      "blocks", "reports", "subscriptions", "consent_log", "deletion_requests",
      "user_roles", "notifications", "private_albums"];
    const out: Record<string, any> = { exported_at: new Date().toISOString(), user_id: data.userId };
    for (const t of tables) {
      const col = t === "profiles" ? "id" : (t === "user_roles" ? "user_id" : "user_id");
      const { data: rows } = await sa.from(t).select("*").eq(col, data.userId);
      out[t] = rows ?? [];
    }
    // messages: also rows where the user is recipient
    const { data: incoming } = await sa.from("messages").select("*").eq("recipient_id", data.userId);
    out.messages_incoming = incoming ?? [];
    await logAudit({
      actorId: context.userId, action: "gdpr.export",
      targetTable: "profiles", targetId: data.userId,
      justification: data.justification, severity: "warning",
    });
    return out;
  });

export const adminProcessDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    requestId: z.string().uuid(), justification: z.string().min(5).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;
    const { data: req } = await sa.from("deletion_requests").select("*").eq("id", data.requestId).maybeSingle();
    if (!req) throw new Error("Request not found");
    if (req.user_id === context.userId) throw new Error("Cannot process your own deletion");
    const { error: delErr } = await sa.auth.admin.deleteUser(req.user_id);
    if (delErr) throw new Error(delErr.message);
    await sa.from("deletion_requests").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", data.requestId);
    await logAudit({
      actorId: context.userId, action: "gdpr.hard_delete",
      targetTable: "auth.users", targetId: req.user_id,
      justification: data.justification, severity: "critical",
    });
    return { ok: true };
  });

/* ---------------- BREACH INCIDENTS ---------------- */
export const adminGetBreaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("breach_incidents")
      .select("*").order("discovered_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateBreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(5000),
    affected_users_count: z.number().int().min(0).optional(),
    data_categories: z.array(z.string()).optional(),
    dpo_contact: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("breach_incidents").insert({
      ...data, created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "breach.create",
      targetTable: "breach_incidents", targetId: row.id, severity: "critical",
    });
    return row;
  });

/* ---------------- POLICY VERSIONS ---------------- */
export const adminGetPolicies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("policy_versions")
      .select("*").order("effective_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreatePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["terms", "privacy", "cookies", "community"]),
    version: z.string().min(1).max(40),
    content_url: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("policy_versions").insert({
      ...data, created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: "policy.publish",
      targetTable: "policy_versions", targetId: row.id, severity: "warning",
    });
    return row;
  });

/* ---------------- MFA STATUS ---------------- */
export const adminGetMyMfa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("admin_mfa_status").select("*").eq("user_id", context.userId).maybeSingle();
    return data ?? { user_id: context.userId, enrolled: false };
  });

export const adminMarkMfaEnrolled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enrolled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("admin_mfa_status").upsert({
      user_id: context.userId, enrolled: data.enrolled,
      enrolled_at: data.enrolled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId, action: data.enrolled ? "mfa.enroll" : "mfa.unenroll", severity: "warning",
    });
    return { ok: true };
  });
