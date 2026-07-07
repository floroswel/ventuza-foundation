/**
 * ADMIN — Notificări livrate unui user.
 *
 * Sursă exclusivă: `public.notification_dispatch_log` — coloane sigure by
 * design (`actor_id`, `target_id`, `kind`, `channel`, `created_at`). NU
 * există câmp de body/media/caption în această tabelă, deci nu se poate
 * scurge conținut de mesaj indiferent de proiecție. Menținem această
 * garanție și în cod: `SELECT` explicit doar pe coloanele de mai sus,
 * fără `*` și fără JOIN cu `messages` / `notifications`.
 *
 * Endpoint-uri:
 *  - `adminGetUserNotificationsSummary({ userId, sinceDays? })` →
 *      { total, byKind[], byChannel[], byDay[], firstAt, lastAt }
 *  - `adminGetUserNotificationsTimeline({ userId, limit?, before? })` →
 *      pagină cronologică descrescătoare cu evenimente (fără body).
 *
 * Gate:
 *  - `requireSupabaseAuth` + `is_staff` (moderator / admin / super_admin /
 *    auditor / support). Nu adăugăm break-glass pentru că nu se dezvăluie
 *    date sensibile.
 *  - Scriere audit: NU (read-only pe date deja audit-only).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(sb: any, uid: string) {
  const { data } = await sb.rpc("is_staff", { _uid: uid });
  if (!data) throw new Error("Forbidden: staff role required");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
const SummaryInput = z.object({
  userId: z.string().uuid(),
  sinceDays: z.number().int().min(1).max(365).default(30),
});

export const adminGetUserNotificationsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SummaryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = context.supabase as any;
    const sinceIso = new Date(Date.now() - data.sinceDays * 86_400_000).toISOString();

    // Doar coloane sigure. Fără body / conținut. Fără JOIN cu messages.
    const { data: rows, error } = await sb
      .from("notification_dispatch_log")
      .select("kind,channel,created_at")
      .eq("target_id", data.userId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{ kind: string; channel: string; created_at: string }>;

    const total = list.length;
    const byKindMap = new Map<string, number>();
    const byChannelMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    let firstAt: string | null = null;
    let lastAt: string | null = null;

    for (const r of list) {
      byKindMap.set(r.kind, (byKindMap.get(r.kind) ?? 0) + 1);
      byChannelMap.set(r.channel, (byChannelMap.get(r.channel) ?? 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      if (!lastAt || r.created_at > lastAt) lastAt = r.created_at;
      if (!firstAt || r.created_at < firstAt) firstAt = r.created_at;
    }

    const byKind = [...byKindMap.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);
    const byChannel = [...byChannelMap.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);
    const byDay = [...byDayMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));

    return {
      total,
      sinceDays: data.sinceDays,
      firstAt,
      lastAt,
      byKind,
      byChannel,
      byDay,
      truncated: total >= 5000,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
const TimelineInput = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(100),
  before: z.string().datetime().optional(),
  kind: z.string().max(60).optional(),
  channel: z.string().max(40).optional(),
});

export const adminGetUserNotificationsTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TimelineInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = context.supabase as any;

    let q = sb
      .from("notification_dispatch_log")
      .select("id,kind,channel,actor_id,created_at,message_id,event_id")
      .eq("target_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.before) q = q.lt("created_at", data.before);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.channel) q = q.eq("channel", data.channel);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const items = (rows ?? []) as Array<{
      id: number;
      kind: string;
      channel: string;
      actor_id: string | null;
      created_at: string;
      message_id: string | null;
      event_id: string | null;
    }>;

    // Cursor pentru pagină următoare (based on ultima intrare).
    const nextBefore = items.length === data.limit ? items[items.length - 1].created_at : null;


    return {
      items,
      nextBefore,
    };
  });
