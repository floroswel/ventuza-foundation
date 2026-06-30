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
