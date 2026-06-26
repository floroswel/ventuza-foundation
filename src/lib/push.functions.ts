import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
});

/** Save / refresh the browser's Web Push subscription for the current user. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubInput.parse(d))
  .handler(async ({ data, context }) => {
    // Upsert by endpoint (1 subscription per browser).
    const { error } = await context.supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          platform: "web",
          kind: "webpush",
          fcm_token: data.endpoint, // legacy NOT NULL column — reuse endpoint
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true };
  });

const UnsubInput = z.object({ endpoint: z.string().url() });
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UnsubInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });

const SendInput = z.object({
  toUserId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  url: z.string().max(500).optional(),
  tag: z.string().max(80).optional(),
  /** Logical category — checked against recipient's notification_prefs. */
  category: z.enum(["matches", "messages", "likes", "events", "marketing"]).optional(),
});

type Prefs = {
  matches?: boolean;
  messages?: boolean;
  likes?: boolean;
  events?: boolean;
  marketing?: boolean;
  master_push?: boolean;
  quiet_enabled?: boolean;
  quiet_start?: number;
  quiet_end?: number;
};

function inQuietWindow(prefs: Prefs, tzOffsetMinutes: number): boolean {
  if (!prefs?.quiet_enabled) return false;
  const start = Number(prefs.quiet_start ?? 23);
  const end = Number(prefs.quiet_end ?? 7);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const nowLocal = new Date(Date.now() + (tzOffsetMinutes ?? 0) * 60_000);
  const h = nowLocal.getUTCHours();
  // Window wraps midnight (e.g. 23 → 7) vs. same-day (e.g. 13 → 14).
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/** Send a push to another user (used internally on message/tap/woof/match). */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    // Don't ping yourself.
    if (data.toUserId === context.userId) return { delivered: 0, skipped: "self" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOne } = await import("./web-push.server");

    // Respect recipient preferences (master toggle, per-category, quiet hours, discrete mode).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("notification_prefs, tz_offset_minutes, discrete_mode")
      .eq("id", data.toUserId)
      .maybeSingle();

    const prefs = (profile?.notification_prefs ?? {}) as Prefs;
    if (prefs.master_push === false) return { delivered: 0, skipped: "master_off" as const };
    if (data.category && prefs[data.category] === false) {
      return { delivered: 0, skipped: "category_off" as const };
    }
    if (inQuietWindow(prefs, profile?.tz_offset_minutes ?? 0)) {
      return { delivered: 0, skipped: "quiet_hours" as const };
    }

    // Discrete mode: strip preview, replace with generic copy.
    const title = profile?.discrete_mode ? "Ventuza" : data.title;
    const body = profile?.discrete_mode ? "Ai o notificare nouă" : data.body;

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,kind")
      .eq("user_id", data.toUserId);

    if (!subs?.length) return { delivered: 0 };

    let delivered = 0;
    const expired: string[] = [];
    for (const s of subs) {
      if (s.kind !== "webpush" || !s.endpoint) continue;
      const r = await sendOne(
        { id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        { title: data.title, body: data.body, url: data.url, tag: data.tag },
      );
      if (r.ok) delivered++;
      else if (r.gone) expired.push(s.id);
    }
    if (expired.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
    }
    return { delivered };
  });

