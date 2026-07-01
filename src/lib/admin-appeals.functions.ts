// Appeals (DSA Art. 20) — server functions
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

/* USER — submit appeal */
const SubmitIn = z.object({
  kind: z.enum(["ban", "suspension", "content_removed", "account_deleted", "photo_rejected", "other"]),
  actionRef: z.string().max(200).nullable().optional(),
  originalReason: z.string().max(500).nullable().optional(),
  userStatement: z.string().min(20).max(4000),
  evidenceUrls: z.array(z.string().url()).max(10).default([]),
});
export const submitAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitIn.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("appeals").insert({
      user_id: context.userId,
      kind: data.kind,
      action_ref: data.actionRef ?? null,
      original_reason: data.originalReason ?? null,
      user_statement: data.userStatement,
      evidence_urls: data.evidenceUrls,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Ai deja o contestație activă pentru această acțiune.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const listMyAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("appeals")
      .select("id, kind, action_ref, status, decision_reason, created_at, reviewed_at")
      .eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* STAFF — list queue */
const ListIn = z.object({
  status: z.enum(["open", "under_review", "granted", "denied", "withdrawn", "all"]).default("open"),
  kind: z.string().max(30).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
export const adminListAppeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListIn.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    let q = sa.from("appeals").select("*", { count: "exact" })
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: p } = await sa.from("profiles").select("id, display_name, banned_at, suspended_until").in("id", ids);
      names = new Map((p ?? []).map((x: any) => [x.id, x]));
    }
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, profile: names.get(r.user_id) ?? null })),
      count: count ?? 0,
    };
  });

/* STAFF — decide appeal */
const DecideIn = z.object({
  appealId: z.string().uuid(),
  decision: z.enum(["granted", "denied", "under_review"]),
  decisionReason: z.string().min(10).max(2000),
  autoLift: z.boolean().default(false),
});
export const adminDecideAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideIn.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_decide_appeal", {
      _appeal_id: data.appealId,
      _decision: data.decision,
      _decision_reason: data.decisionReason,
    });
    if (error) throw new Error(error.message);
    // Optional: auto-unban when granted
    if (data.decision === "granted" && data.autoLift) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sa = supabaseAdmin as any;
      const { data: appeal } = await sa.from("appeals").select("user_id, kind").eq("id", data.appealId).maybeSingle();
      if (appeal?.user_id && (appeal.kind === "ban" || appeal.kind === "suspension")) {
        await sa.from("profiles").update({ banned_at: null, suspended_until: null }).eq("id", appeal.user_id);
      }
    }
    return { ok: true };
  });
