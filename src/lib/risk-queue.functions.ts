import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReviewQueueRow = {
  flag_id: string;
  user_id: string;
  display_name: string | null;
  account_created_at: string;
  flag_created_at: string;
  risk_score: number;
  severity: number;
  details: string | null;
  verified: boolean;
  banned_at: string | null;
  suspended_until: string | null;
  report_count: number;
};

/** List new accounts auto-flagged for manual review (open queue). */
export const adminListNewAccountReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "admin_new_account_review_queue",
      { _limit: data.limit ?? 100 },
    );
    if (error) throw new Error(error.message);
    const normalized: ReviewQueueRow[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as ReviewQueueRow),
      details: r.details == null ? null : JSON.stringify(r.details),
    }));
    return { rows: normalized };
  });

const ResolveInput = z.object({
  flagId: z.string().uuid(),
  decision: z.enum(["cleared", "false_positive", "escalated", "resolved"]),
  notes: z.string().max(1000).optional(),
});

/** Resolve a queued risk flag with a decision (audit-logged server-side). */
export const adminResolveRiskFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResolveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_resolve_risk_flag", {
      _flag_id: data.flagId,
      _decision: data.decision,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type UserRiskDetail = {
  profile: {
    id: string;
    display_name: string | null;
    profile_slug: string | null;
    created_at: string;
    risk_score: number;
    risk_signals: any;
    risk_updated_at: string | null;
    age_status: string | null;
    banned_at: string | null;
    suspended_until: string | null;
    partner_suspended_at: string | null;
  } | null;
  flags: Array<{
    id: string;
    kind: string;
    severity: number;
    status: string;
    details: any;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
  }>;
  reports_received: number;
  reports_made: number;
  audit: Array<{
    id: string;
    action: string;
    severity: string | null;
    actor_email: string | null;
    created_at: string;
    justification: string | null;
  }>;
};


/** Detailed risk profile for a single user: score, signals breakdown, full flag timeline. */
export const adminGetUserRiskDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isStaff, error: rErr } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!isStaff) throw new Error("Forbidden: staff role required");

    const sb = context.supabase as any;

    const [profileRes, flagsRes, recvRes, madeRes, auditRes] = await Promise.all([
      sb.from("profiles")
        .select("id, display_name, profile_slug, created_at, risk_score, risk_signals, risk_updated_at, age_status, banned_at, suspended_until, partner_suspended_at")
        .eq("id", data.userId)
        .maybeSingle(),
      sb.from("risk_flags")
        .select("id, kind, severity, status, details, created_at, resolved_at, resolved_by")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(200),
      sb.from("reports").select("id", { count: "exact", head: true }).eq("reported_id", data.userId),
      sb.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", data.userId),
      sb.from("admin_audit_log")
        .select("id, action, severity, actor_email, created_at, justification")
        .eq("target_table", "profiles")
        .eq("target_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (flagsRes.error) throw new Error(flagsRes.error.message);

    return {
      profile: profileRes.data ?? null,
      flags: flagsRes.data ?? [],
      reports_received: recvRes.count ?? 0,
      reports_made: madeRes.count ?? 0,
      audit: auditRes.error ? [] : (auditRes.data ?? []),
    } as unknown as Record<string, unknown>;
  });


