/**
 * Timeline unificat pentru User360.
 * Agregă evenimente din: admin_audit_log, consent_log, reports (target),
 * appeals, deletion_requests, partner_status_notifications, user_strikes,
 * user_badge_grants, verification_requests.
 *
 * Rezultatul e o listă cronologică descrescătoare (limit 200), fiecare item cu:
 *  { at, kind, title, details, severity }
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(sb: any, uid: string) {
  const { data } = await sb.rpc("is_staff", { _uid: uid });
  if (!data) throw new Error("Forbidden");
}

const Input = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(500).default(200),
});

type TimelineEvent = {
  at: string;
  kind: string;
  title: string;
  details?: string;
  severity?: string;
};

export const adminGetUserTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = context.supabase as any;
    const events: TimelineEvent[] = [];

    // audit log where target
    const { data: audit } = await sb
      .from("admin_audit_log")
      .select("created_at,action,severity,after_data")
      .eq("target_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    for (const a of audit ?? []) {
      events.push({
        at: a.created_at,
        kind: "admin_action",
        title: a.action,
        details: a.after_data ? JSON.stringify(a.after_data).slice(0, 200) : undefined,
        severity: a.severity ?? "info",
      });
    }

    // consents
    const { data: consents } = await sb
      .from("consent_log")
      .select("created_at,kind,version,accepted")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const c of consents ?? []) {
      events.push({
        at: c.created_at,
        kind: c.accepted ? "consent_granted" : "consent_withdrawn",
        title: `${c.kind} v${c.version}`,
        severity: c.accepted ? "info" : "warning",
      });
    }

    // reports against user
    const { data: reports } = await sb
      .from("reports")
      .select("created_at,reason,status")
      .eq("reported_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const r of reports ?? []) {
      events.push({
        at: r.created_at,
        kind: "report_target",
        title: `Raport: ${r.reason ?? "—"}`,
        details: `status: ${r.status}`,
        severity: "warning",
      });
    }

    // appeals
    const { data: appeals } = await sb
      .from("appeals")
      .select("created_at,kind,status")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const ap of appeals ?? []) {
      events.push({
        at: ap.created_at,
        kind: "appeal",
        title: `Appeal: ${ap.kind}`,
        details: `status: ${ap.status}`,
      });
    }

    // strikes
    const { data: strikes } = await sb
      .from("user_strikes")
      .select("created_at,severity,reason,revoked_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const s of strikes ?? []) {
      events.push({
        at: s.created_at,
        kind: "strike",
        title: `Strike sev ${s.severity}${s.revoked_at ? " (revocat)" : ""}`,
        details: s.reason,
        severity: s.severity >= 4 ? "critical" : "warning",
      });
    }

    // badge grants
    const { data: grants } = await sb
      .from("user_badge_grants")
      .select("granted_at,badge_code,revoked_at,revoke_reason,reason")
      .eq("user_id", data.userId)
      .order("granted_at", { ascending: false })
      .limit(50);
    for (const g of grants ?? []) {
      events.push({
        at: g.granted_at,
        kind: "badge_granted",
        title: `Badge acordat: ${g.badge_code}`,
        details: g.reason,
      });
      if (g.revoked_at) {
        events.push({
          at: g.revoked_at,
          kind: "badge_revoked",
          title: `Badge revocat: ${g.badge_code}`,
          details: g.revoke_reason ?? undefined,
          severity: "warning",
        });
      }
    }

    // verification requests
    const { data: verifs } = await sb
      .from("verification_requests")
      .select("submitted_at,decided_at,status,decision")
      .eq("user_id", data.userId)
      .order("submitted_at", { ascending: false })
      .limit(20);
    for (const v of verifs ?? []) {
      events.push({
        at: v.submitted_at,
        kind: "verification_submitted",
        title: `Verificare: ${v.status}`,
      });
      if (v.decided_at) {
        events.push({
          at: v.decided_at,
          kind: "verification_decided",
          title: `Verificare decisă: ${v.decision}`,
          severity: v.decision === "approve" ? "info" : "warning",
        });
      }
    }

    // deletion requests
    const { data: dels } = await sb
      .from("deletion_requests")
      .select("requested_at,status,processed_at")
      .eq("user_id", data.userId)
      .order("requested_at", { ascending: false })
      .limit(10);
    for (const d of dels ?? []) {
      events.push({
        at: d.requested_at,
        kind: "deletion_request",
        title: `Cerere ștergere: ${d.status}`,
        severity: "critical",
      });
    }

    events.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { events: events.slice(0, data.limit) };
  });
