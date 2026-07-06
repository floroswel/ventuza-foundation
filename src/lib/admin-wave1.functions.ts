/**
 * WAVE 1 — server fns pentru modulele M1 (Useri), M13 (GDPR ops),
 * M14 (Audit & Sensitive-Access viewer). Restul (moderare CSAM/DSA) reutilizează
 * `admin-enterprise.functions.ts`.
 *
 * REGULI APLICATE:
 *  - RBAC enforced server-side (has_role / has_any_role / is_admin_or_above).
 *  - Orice mutație → admin_audit_log (actor, IP, before→after, severitate).
 *  - Niciun câmp Art. 9 / locație precisă / mesaj brut returnat — fără
 *    break-glass (vezi `admin-break-glass.functions.ts`).
 *  - Reutilizare fluxuri: `purgeUserAccount` (account.server) pentru ștergere.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* -------------------- helpers -------------------- */
async function reqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {}
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {}
  return { ip, ua };
}

async function assertRole(
  supabase: any,
  userId: string,
  roles: Array<"super_admin" | "admin" | "auditor" | "moderator" | "support" | "read_only">,
) {
  const { data, error } = await supabase.rpc("has_any_role", { _user_id: userId, _roles: roles });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: rol insuficient");
}

async function logAudit(opts: {
  actorId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  before?: any;
  after?: any;
  justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const meta = await reqMeta();
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId,
    action: opts.action,
    target_table: opts.targetTable ?? null,
    target_id: opts.targetId ?? null,
    before_data: opts.before ?? null,
    after_data: opts.after ?? null,
    justification: opts.justification ?? null,
    severity: opts.severity ?? "info",
    ip: meta.ip,
    user_agent: meta.ua,
  });
}

/* =================================================================
   M1 — USERI
================================================================= */

/** Istoric consimțăminte al unui user — read-only, doar metadatele (kind,
 *  version, accepted, ts). Nu expune valori sensibile gatate. */
export const adminGetUserConsentHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, [
      "super_admin",
      "admin",
      "auditor",
      "moderator",
      "support",
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("consent_log")
      .select("id, kind, version, accepted, ip, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Forțează logout pe un user (revocare sesiuni active). */
export const adminForceLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        justification: z.string().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin", "moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).auth.admin.signOut(data.userId, "global");
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      action: "user.force_logout",
      targetTable: "auth.users",
      targetId: data.userId,
      justification: data.justification,
      severity: "warning",
    });
    return { ok: true };
  });

/** Trimite email de resetare parolă. */
export const adminTriggerPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        justification: z.string().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: u, error: e1 } = await sa.auth.admin.getUserById(data.userId);
    if (e1) throw new Error(e1.message);
    const email = u?.user?.email;
    if (!email) throw new Error("User fără email — resetare imposibilă");
    const { error } = await sa.auth.admin.generateLink({ type: "recovery", email });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      action: "user.password_reset",
      targetTable: "auth.users",
      targetId: data.userId,
      justification: data.justification,
      severity: "warning",
    });
    return { ok: true };
  });

/** Retrimite emailul de confirmare a contului (userilor cu `email_confirmed_at IS NULL`). */
export const adminResendConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        justification: z.string().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin", "support"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: u, error: e1 } = await sa.auth.admin.getUserById(data.userId);
    if (e1) throw new Error(e1.message);
    const email = u?.user?.email;
    if (!email) throw new Error("User fără email — retrimitere imposibilă");
    if (u?.user?.email_confirmed_at) {
      throw new Error("Emailul este deja confirmat.");
    }
    // `generateLink` cu type=signup regenerează link-ul de confirmare și,
    // dacă hook-ul de emailuri e activ, îl retrimite către user.
    const { error } = await sa.auth.admin.generateLink({ type: "signup", email });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      action: "user.resend_confirmation_email",
      targetTable: "auth.users",
      targetId: data.userId,
      justification: data.justification,
      severity: "info",
    });
    return { ok: true, email };
  });

// NOTE: Adminul nu mai poate acorda „verified" direct pe cont. Aprobarea
// vine exclusiv din panoul intern de verificare (`/admin/verification`) prin
// `verification_moderator_decide`, care este auditat și dublu-review-uit
// când e cazul.



/** Vizualizare combinată user — profil mascat + consents + verificări + reports. */
export const adminGetUserView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, [
      "super_admin",
      "admin",
      "auditor",
      "moderator",
      "support",
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    // NOTE: `age` și `is_premium` NU există ca coloane pe `public.profiles` —
    // le derivăm mai jos (din `birthdate`, respectiv din `subscriptions.status='active'`).
    // Ultima activitate = `last_seen` (aliasat ca `last_active_at` pentru UI).
    const SAFE_PROFILE = [
      "id",
      "display_name",
      "profile_slug",
      "bio",
      "travel_city",
      "verified",
      "verified_at",
      "age_status",
      "age_verified_at",
      "verification_status",
      "verification_method",
      "verification_reason",
      "verification_reviewed_by",
      "hide_age",
      "birthdate",
      "banned_at",
      "banned_reason",
      "warned_at",
      "warned_reason",
      "suspended_until",
      "suspended_reason",
      "deleted_at",
      "partner_suspended_at",
      "partner_suspension_reason",
      "report_count",
      "risk_score",
      "risk_updated_at",
      "level",
      "xp",
      "streak_days",
      "boost_until",
      "boosts_balance",
      "super_taps_balance",
      "profile_completion",
      "onboarding_completed",
      "preferred_language",
      "created_at",
      "updated_at",
      "last_seen",
      "last_check_in_at",
      "interests",
      "prompts",
    ].join(",");
    const [prof, consents, verifs, reports, roles, activeSubs] = await Promise.all([
      sa.from("profiles").select(SAFE_PROFILE).eq("id", data.userId).maybeSingle(),
      sa
        .from("consent_log")
        .select("id, kind, version, accepted, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      sa
        .from("verification_requests")
        .select("id, status, decision, method, needs_second, submitted_at, decided_at")
        .eq("user_id", data.userId)
        .order("submitted_at", { ascending: false })
        .limit(20),
      sa
        .from("reports")
        .select("id, reason, status, created_at")
        .eq("reported_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      sa.from("user_roles").select("role").eq("user_id", data.userId),
      sa
        .from("subscriptions")
        .select("id, status, platform, product_id, expires_at")
        .eq("user_id", data.userId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1),
    ]);
    const p = prof.data ?? null;
    let age: number | null = null;
    if (p && (p as any).birthdate) {
      const bd = new Date((p as any).birthdate as string);
      if (!isNaN(bd.getTime())) {
        const now = new Date();
        age = now.getFullYear() - bd.getFullYear();
        const m = now.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age -= 1;
      }
    }
    const activeSub = (activeSubs.data ?? [])[0] ?? null;
    const enrichedProfile: any = p
      ? {
          ...(p as any),
          age,
          is_premium: !!activeSub,
          last_active_at: (p as any).last_seen ?? null,
          active_subscription: activeSub,
        }
      : null;
    return {
      profile: enrichedProfile,
      consents: consents.data ?? [],
      verifications: verifs.data ?? [],
      reports: reports.data ?? [],
      roles: (roles.data ?? []).map((r: any) => r.role),
      masked: true,
    };
  });

/* =================================================================
   M13 — GDPR OPS
================================================================= */

/** Anulează o cerere de ștergere (scheduled → cancelled). */
export const adminCancelDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        justification: z.string().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: before } = await sa
      .from("deletion_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!before) throw new Error("Cerere inexistentă");
    const { error } = await sa
      .from("deletion_requests")
      .update({ status: "cancelled" })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      action: "gdpr.cancel_deletion",
      targetTable: "deletion_requests",
      targetId: data.requestId,
      before,
      after: { status: "cancelled" },
      justification: data.justification,
      severity: "warning",
    });
    return { ok: true };
  });

/** Ștergere completă reutilizând fluxul `purgeUserAccount`
 *  (RC cancel + storage cleanup + cascade FK). */
export const adminPurgeUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        justification: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);
    if (data.userId === context.userId) throw new Error("Nu te poți șterge pe tine.");
    const { purgeUserAccount } = await import("./account.server");
    const r = await purgeUserAccount(data.userId, "admin_gdpr", {
      actorId: context.userId,
      justification: data.justification,
    });
    return { ok: true, rcNote: r.rcNote };
  });

/** Rulează manual purge-ul programat — super_admin only. */
export const adminRunPurgeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ justification: z.string().min(10).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("purge_scheduled_deletions");
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      action: "gdpr.manual_purge",
      after: { result },
      justification: data.justification,
      severity: "critical",
    });
    return { ok: true, result };
  });

/** Trail GDPR — filtrează admin_audit_log pe action LIKE 'gdpr.%' sau 'backfill%'. */
export const adminGetGdprTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin", "auditor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("admin_audit_log")
      .select("*")
      .or("action.ilike.gdpr.%,action.ilike.backfill%")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
