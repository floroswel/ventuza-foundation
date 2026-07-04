// Panou verificare identitate (moderare internă).
// Cererile trăiesc în `verification_requests` + imaginile în bucket privat
// `verification`. Retenție: 30 zile (col. `retention_until` din DB), apoi
// purge automat. Imaginile se accesează DOAR prin signed URL 30s generat aici.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertVerificationStaff(sb: any, userId: string) {
  const { data, error } = await sb.rpc("is_verification_staff", { _uid: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: rol verification_moderator/admin/super_admin necesar.");
}

/* ---------------- LIST ---------------- */
const ListInput = z.object({
  status: z
    .enum(["pending", "in_review", "needs_second", "approved", "rejected", "appeal", "expired"])
    .optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const adminListVerificationRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertVerificationStaff(context.supabase, context.userId);
    let q = context.supabase
      .from("verification_requests")
      .select(
        "id,user_id,status,method,version,submitted_at,claimed_at,decided_at,decision,reason,reason_code,confidence,score,moderator_id,second_moderator_id,needs_second,retention_until,country",
      )
      .order("submitted_at", { ascending: true })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Enrichment: display_name al userilor
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    let names: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
    }
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, display_name: names[r.user_id] ?? null })),
    };
  });

/* ---------------- STATS ---------------- */
export const adminVerificationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertVerificationStaff(context.supabase, context.userId);
    const statuses = [
      "pending",
      "in_review",
      "needs_second",
      "approved",
      "rejected",
      "appeal",
      "expired",
    ];
    const counts: Record<string, number> = {};
    for (const s of statuses) {
      const { count } = await context.supabase
        .from("verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      counts[s] = count ?? 0;
    }
    // decizii ultimele 7 zile
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: approved7d } = await context.supabase
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("decision", "approve")
      .gte("decided_at", since);
    const { count: rejected7d } = await context.supabase
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("decision", "reject")
      .gte("decided_at", since);
    return {
      counts,
      approved_7d: approved7d ?? 0,
      rejected_7d: rejected7d ?? 0,
      retention_days: 30,
    };
  });

/* ---------------- CLAIM ---------------- */
export const adminClaimVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertVerificationStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("verification_moderator_claim");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { request: null as null };
    return { request: row };
  });

/* ---------------- SIGNED URLS pentru imagini (30s) ---------------- */
const UrlsInput = z.object({ requestId: z.string().uuid() });

export const adminVerificationSignedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UrlsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertVerificationStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: imgs, error } = await sa
      .from("verification_images")
      .select("id,order_idx,challenge_code,storage_path,captured_at,deleted_at")
      .eq("request_id", data.requestId)
      .is("deleted_at", null)
      .order("order_idx", { ascending: true });
    if (error) throw new Error(error.message);
    const out: Array<{
      id: string;
      order_idx: number;
      challenge_code: string;
      captured_at: string;
      url: string | null;
    }> = [];
    for (const im of imgs ?? []) {
      const { data: signed } = await sa.storage
        .from("verification")
        .createSignedUrl(im.storage_path, 30);
      out.push({
        id: im.id,
        order_idx: im.order_idx,
        challenge_code: im.challenge_code,
        captured_at: im.captured_at,
        url: signed?.signedUrl ?? null,
      });
    }
    // audit acces la selfie-uri
    await sa.from("admin_sensitive_access_log").insert({
      actor_id: context.userId,
      target_user_id: null,
      kind: "verification_images",
      fields: ["storage_path"],
      justification: `viewed request ${data.requestId}`,
    });
    return { images: out };
  });

/* ---------------- DECIDE ---------------- */
const DecideInput = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "needs_second", "appeal_required"]),
  reasonCode: z.string().min(1).max(64),
  reason: z.string().min(1).max(500),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

export const adminDecideVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertVerificationStaff(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("verification_moderator_decide", {
      p_request_id: data.requestId,
      p_decision: data.decision,
      p_reason_code: data.reasonCode,
      p_reason: data.reason,
      p_confidence: data.confidence,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
