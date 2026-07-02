// Broadcast v2 — campaigns cu filtre reale, dry-run, tracking.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb.rpc("is_admin_or_above", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const AudienceFilter = z.object({
  verified: z.boolean().optional(),
  minAgeDays: z.number().int().min(0).max(3650).optional(),
  maxAgeDays: z.number().int().min(0).max(3650).optional(),
  role: z.enum(["user", "business", "partner"]).optional(),
  city: z.string().max(120).optional(),
  planCode: z.string().max(40).optional(),
  activeSince: z.string().datetime().optional(),
  hasNoActivity30d: z.boolean().optional(),
});
type AudienceFilterT = z.infer<typeof AudienceFilter>;

async function selectAudience(sa: any, f: AudienceFilterT): Promise<string[]> {
  let q = sa.from("profiles").select("id");
  if (f.verified !== undefined) q = q.eq("verified", f.verified);
  if (f.city) q = q.ilike("city", f.city);
  if (f.planCode) q = q.eq("plan_code", f.planCode);
  if (f.minAgeDays !== undefined)
    q = q.lte("created_at", new Date(Date.now() - f.minAgeDays * 86400000).toISOString());
  if (f.maxAgeDays !== undefined)
    q = q.gte("created_at", new Date(Date.now() - f.maxAgeDays * 86400000).toISOString());
  if (f.activeSince) q = q.gte("last_active_at", f.activeSince);
  if (f.hasNoActivity30d)
    q = q.lte("last_active_at", new Date(Date.now() - 30 * 86400000).toISOString());
  const { data: profs, error } = await q.limit(20000);
  if (error) throw new Error(error.message);
  let ids: string[] = (profs ?? []).map((p: any) => p.id);
  if (f.role) {
    const { data: rr } = await sa.from("user_roles").select("user_id").eq("role", f.role);
    const set = new Set((rr ?? []).map((r: any) => r.user_id));
    if (f.role === "user") ids = ids.filter((i) => !set.has(i));
    else ids = ids.filter((i) => set.has(i));
  }
  return ids;
}

/* Dry-run: doar întoarce count-ul */
const DryIn = z.object({ filter: AudienceFilter });
export const broadcastPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DryIn.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = await selectAudience(supabaseAdmin as any, data.filter);
    return { count: ids.length };
  });

/* Send broadcast: persistă campanie + inserează în notifications */
const SendIn = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(1000),
  link: z.string().url().optional(),
  channel: z.enum(["inapp", "push", "both"]).default("inapp"),
  filter: AudienceFilter,
});
export const broadcastSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendIn.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    let ip: string | null = null,
      ua: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {}
    try {
      ua = getRequestHeader("user-agent") ?? null;
    } catch {}

    const ids = await selectAudience(sa, data.filter);
    const { data: campaign, error: cErr } = await sa
      .from("broadcast_campaigns")
      .insert({
        created_by: context.userId,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
        channel: data.channel,
        audience_filter: data.filter,
        target_count: ids.length,
        status: "sending",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    let delivered = 0;
    if (ids.length) {
      const rows = ids.map((uid) => ({
        user_id: uid,
        type: "admin_message" as const,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
        actor_id: context.userId,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await sa.from("notifications").insert(chunk);
        if (!error) delivered += chunk.length;
      }
    }
    await sa
      .from("broadcast_campaigns")
      .update({
        status: "sent",
        delivered_count: delivered,
        finished_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "broadcast_send",
      target_table: "broadcast_campaigns",
      target_id: campaign.id,
      after_data: { title: data.title, channel: data.channel, target: ids.length, delivered },
      severity: "info",
      ip,
      user_agent: ua,
    });
    return { campaignId: campaign.id, target: ids.length, delivered };
  });

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("broadcast_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
