/**
 * USER 360 — server fns adăugate pentru ecranul unitar /admin/users/$id.
 *
 * Reguli AGENTS.md aplicate:
 *  - RBAC enforced server-side (has_any_role).
 *  - Toate mutațiile cer `justification` (min. 10 caractere) și scriu în
 *    `admin_audit_log` (actor, target, before→after, severitate, IP, UA).
 *  - MFA enforced (`assertAdminMfa`) pe ORICE acțiune cu efect (edit, email,
 *    push unicast). Read-only fns nu cer MFA.
 *  - Niciun câmp Art. 9 / locație precisă nu este returnat. Profilul editabil
 *    e limitat la `display_name`, `bio`, `birthdate` (cu validare ≥18 prin
 *    trigger DB existent), `travel_city`. Email-ul se schimbă prin
 *    `auth.admin.updateUserById`.
 *  - Push unicast respectă `notification_prefs.master_push=false` (opt-out
 *    hard); doar canalul de quiet hours / categorii e bypassed pentru staff
 *    messages (justificat ca safety/ToS warning, nu marketing).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- helpers (paralel cu admin-wave1) ---------- */
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
  const meta = await reqMeta();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // NOTE: coloanele reale sunt before_data / after_data (jsonb).
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
   READ — activitate completă (sesiuni, plăți, fingerprints, rapoarte)
   ================================================================= */

/**
 * Întoarce, într-un singur apel, tot ce e relevant pentru User 360 care nu
 * vine deja prin `adminGetUserView`. Coloane sensibile (endpoint push,
 * fingerprint brut, IP brut, body mesaje) sunt MASCATE — break-glass rămâne
 * singura cale către valorile reale.
 */
export const adminGetUserActivity = createServerFn({ method: "POST" })
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

    const [
      authUser,
      devices,
      subs,
      invoicesPaid,
      reportsMade,
      reportsRcvd,
      pushSubs,
      deletionReqs,
      riskFlags,
    ] = await Promise.all([
      sa.auth.admin.getUserById(data.userId),
      sa
        .from("device_fingerprints")
        .select("id, first_seen_at, last_seen_at, fingerprint, user_agent")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false })
        .limit(10),
      sa
        .from("subscriptions")
        .select("id, status, platform, product_id, started_at, expires_at, auto_renew, updated_at")
        .eq("user_id", data.userId)
        .order("started_at", { ascending: false })
        .limit(20),
      sa
        .from("partner_invoices")
        .select("id, series, number, year, total_minor, currency, status, issued_at, paid_at")
        .eq("owner_id", data.userId)
        .order("issued_at", { ascending: false })
        .limit(20),
      sa
        .from("reports")
        .select("id, reported_id, reason, status, created_at")
        .eq("reporter_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      sa
        .from("reports")
        .select("id, reporter_id, reason, status, created_at")
        .eq("reported_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      sa
        .from("push_subscriptions")
        .select("id, kind, platform, created_at, last_seen_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      sa
        .from("deletion_requests")
        .select("id, status, scheduled_at, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(5),
      sa
        .from("risk_flags")
        .select("id, kind, severity, status, created_at, resolved_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Mască fingerprint + user_agent: doar prefixul / familia, ca să nu se poată reconstitui.
    const safeDevices = (devices.data ?? []).map((d: any) => ({
      id: d.id,
      first_seen_at: d.first_seen_at,
      last_seen_at: d.last_seen_at,
      fingerprint_prefix:
        typeof d.fingerprint === "string" ? d.fingerprint.slice(0, 8) + "…" : null,
      ua_family:
        typeof d.user_agent === "string"
          ? (d.user_agent.match(/(Chrome|Firefox|Safari|Edge|Mobile)[\/\s][\d.]*/)?.[0] ??
            "unknown")
          : null,
    }));

    return {
      auth: {
        email: authUser?.data?.user?.email ?? null,
        email_confirmed_at: authUser?.data?.user?.email_confirmed_at ?? null,
        last_sign_in_at: authUser?.data?.user?.last_sign_in_at ?? null,
        created_at: authUser?.data?.user?.created_at ?? null,
        providers: authUser?.data?.user?.app_metadata?.providers ?? [],
      },
      devices: safeDevices,
      subscriptions: subs.data ?? [],
      invoices_as_partner: invoicesPaid.data ?? [],
      reports_made: reportsMade.data ?? [],
      reports_received: reportsRcvd.data ?? [],
      push_subscriptions: pushSubs.data ?? [],
      deletion_requests: deletionReqs.data ?? [],
      risk_flags: riskFlags.data ?? [],
      masked: true,
    };
  });

/* =================================================================
   EDIT — profil (Art. 16 — rectificare)
   ================================================================= */

const UpdateProfileInput = z.object({
  userId: z.string().uuid(),
  changes: z
    .object({
      display_name: z.string().trim().min(1).max(60).optional(),
      bio: z.string().trim().max(500).optional(),
      birthdate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(), // YYYY-MM-DD; triggerul DB refuză <18
      travel_city: z.string().trim().max(80).optional(),
    })
    .refine((c) => Object.keys(c).length > 0, { message: "Niciun câmp de modificat" }),
  justification: z.string().min(10).max(500),
});

export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const cols = Object.keys(data.changes).join(",");
    const { data: before, error: e0 } = await sa
      .from("profiles")
      .select(cols)
      .eq("id", data.userId)
      .maybeSingle();
    if (e0) throw new Error(e0.message);

    const { error } = await sa.from("profiles").update(data.changes).eq("id", data.userId);
    if (error) throw new Error(`Update eșuat: ${error.message}`);

    await logAudit({
      actorId: context.userId,
      action: "user.profile_update",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: data.changes,
      justification: data.justification,
      severity: "warning",
    });
    return { ok: true };
  });

/* =================================================================
   EDIT — email (GDPR Art. 16, identitate)
   ================================================================= */

const ChangeEmailInput = z.object({
  userId: z.string().uuid(),
  newEmail: z.string().trim().email().max(255),
  justification: z.string().min(10).max(500),
});

export const adminChangeUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChangeEmailInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const { data: u0 } = await sa.auth.admin.getUserById(data.userId);
    const oldEmail = u0?.user?.email ?? null;
    if (oldEmail === data.newEmail) throw new Error("Emailul este identic cu cel curent.");

    const { error } = await sa.auth.admin.updateUserById(data.userId, {
      email: data.newEmail,
      email_confirm: true, // admin override — userul își confirmă oricum la următorul login dacă cere
    });
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId,
      action: "user.email_change",
      targetTable: "auth.users",
      targetId: data.userId,
      before: { email: oldEmail },
      after: { email: data.newEmail },
      justification: data.justification,
      severity: "critical",
    });
    return { ok: true };
  });

/* =================================================================
   PUSH UNICAST — mesaj direct staff → user
   ================================================================= */

const UnicastInput = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(280),
  url: z.string().trim().max(500).optional(),
  justification: z.string().min(10).max(500),
});

export const adminPushUnicast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UnicastInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, ["super_admin", "admin", "moderator"]);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    // 1) Notificare in-app (apare în clopoțel chiar dacă push-ul e off).
    const { data: notif, error: nerr } = await sa
      .from("notifications")
      .insert({
        user_id: data.userId,
        type: "admin_message",
        title: data.title,
        body: data.body,
        link: data.url ?? null,
        actor_id: context.userId,
      })
      .select("id")
      .maybeSingle();
    if (nerr) throw new Error(`notificare in-app eșuată: ${nerr.message}`);

    // 2) Push web — respectă opt-out hard `master_push=false` (GDPR/PECR).
    const { data: prof } = await sa
      .from("profiles")
      .select("notification_prefs")
      .eq("id", data.userId)
      .maybeSingle();
    const prefs = (prof?.notification_prefs ?? {}) as Record<string, unknown>;
    let pushDelivered = 0;
    let pushSkipped: string | null = null;
    if (prefs.master_push === false) {
      pushSkipped = "master_off";
    } else {
      const { data: subs } = await sa
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth, kind")
        .eq("user_id", data.userId);
      if (subs?.length) {
        const { sendOne } = await import("./web-push.server");
        for (const s of subs) {
          if (s.kind !== "webpush" || !s.endpoint) continue;
          const r = await sendOne(
            { id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            { title: data.title, body: data.body, url: data.url, tag: "admin_message" },
          );
          if (r.ok) pushDelivered++;
        }
      } else {
        pushSkipped = "no_subscriptions";
      }
    }

    await logAudit({
      actorId: context.userId,
      action: "user.push_unicast",
      targetTable: "notifications",
      targetId: notif?.id ?? null,
      after: {
        title: data.title,
        body: data.body,
        url: data.url,
        push_delivered: pushDelivered,
        push_skipped: pushSkipped,
      },
      justification: data.justification,
      severity: "info",
    });
    return { ok: true, notificationId: notif?.id, pushDelivered, pushSkipped };
  });

/* =================================================================
   Helper UI — caută user după email/display_name pentru bara de search
   ================================================================= */
export const adminQuickFindUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().trim().min(2).max(120),
      })
      .parse(d),
  )
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.q);
    if (isUuid) {
      const { data: p } = await sa
        .from("profiles")
        .select("id, display_name, created_at, banned_at")
        .eq("id", data.q)
        .maybeSingle();
      return p ? [p] : [];
    }
    const { data: rows, error } = await sa
      .from("profiles")
      .select("id, display_name, created_at, banned_at")
      .ilike("display_name", `%${data.q}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* =================================================================
   CONSIMȚĂMINTE — istoric complet paginat + export CSV
   Sursa: consent_log (append-only). Actor = user_id (consimțământ
   self-service). IP este întors mascat la /24 pentru IPv4, iar
   user_agent-ul e redus la familia de browser — datele brute rămân
   accesibile doar prin break-glass.
   ================================================================= */

function maskIp(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  // IPv4 → /24, IPv6 → primele 4 grupuri
  if (v.includes(".")) {
    const parts = v.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (v.includes(":")) {
    const parts = v.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return v;
}
function uaFamily(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/(Chrome|Firefox|Safari|Edge|Opera|Mobile|Android|iPhone|iPad)[\/\s][\d.]*/);
  return m?.[0] ?? "unknown";
}

export const adminGetConsentHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        kind: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
        offset: z.number().int().min(0).default(0),
      })
      .parse(d),
  )
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

    let q = sa
      .from("consent_log")
      .select("id, user_id, kind, version, accepted, ip, user_agent, created_at", {
        count: "exact",
      })
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    // Audit read (categorie sensibilă — trasabilitate accesare istoric consimțăminte)
    await logAudit({
      actorId: context.userId,
      action: "consent_history_view",
      targetTable: "consent_log",
      targetId: data.userId,
      severity: "info",
      after: { count: rows?.length ?? 0, kind: data.kind ?? null },
    });

    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        kind: r.kind,
        version: r.version,
        accepted: r.accepted,
        ip_masked: maskIp(r.ip),
        ua_family: uaFamily(r.user_agent),
        created_at: r.created_at,
        actor_id: r.user_id, // self-service: actor = user
      })),
    };
  });

export const adminExportConsentHistoryCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), justification: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, [
      "super_admin",
      "admin",
      "auditor",
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: rows, error } = await sa
      .from("consent_log")
      .select("id, user_id, kind, version, accepted, ip, user_agent, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: context.userId,
      action: "consent_history_export_csv",
      targetTable: "consent_log",
      targetId: data.userId,
      justification: data.justification,
      severity: "warning",
      after: { rows: rows?.length ?? 0 },
    });

    const header = [
      "id",
      "user_id",
      "kind",
      "version",
      "accepted",
      "ip_masked",
      "ua_family",
      "created_at",
    ].join(",");
    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = (rows ?? [])
      .map((r: any) =>
        [
          r.id,
          r.user_id,
          r.kind,
          r.version,
          r.accepted,
          maskIp(r.ip) ?? "",
          uaFamily(r.user_agent) ?? "",
          r.created_at,
        ]
          .map(esc)
          .join(","),
      )
      .join("\n");
    return { filename: `consents-${data.userId}.csv`, csv: `${header}\n${body}\n` };
  });
