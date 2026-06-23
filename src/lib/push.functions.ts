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
});

/** Send a push to another user (used internally on message/tap/woof/match). */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    // Don't ping yourself.
    if (data.toUserId === context.userId) return { delivered: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOne } = await import("./web-push.server");

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
