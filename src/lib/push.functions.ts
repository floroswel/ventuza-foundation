import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeNotificationPayload } from "./notification-privacy";


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
    const row = {
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent ?? null,
      platform: "web",
      kind: "webpush",
      fcm_token: data.endpoint, // legacy NOT NULL column — reuse endpoint
      last_seen_at: new Date().toISOString(),
    };

    // Attempt 1: upsert by fcm_token (1 subscription per browser).
    let { error } = await context.supabase
      .from("push_subscriptions")
      .upsert(row, { onConflict: "fcm_token" });

    // Auto-repair: if a unique/PK conflict happens on another column (endpoint
    // owned by an old/stale row, sau abonare orfană de la un login precedent),
    // ștergem înregistrările vechi cu același endpoint și reîncercăm.
    const isConflict = (e: typeof error) => {
      if (!e) return false;
      const code = (e as { code?: string }).code ?? "";
      const msg = (e.message ?? "").toLowerCase();
      return (
        code === "23505" ||
        code === "409" ||
        msg.includes("duplicate") ||
        msg.includes("conflict") ||
        msg.includes("unique")
      );
    };

    if (isConflict(error)) {
      // Ștergem orice rând vechi cu acest endpoint (indiferent de user_id —
      // e același browser fizic; ownership-ul se rescrie prin re-insert).
      // Folosim admin ca să curățăm și rândurile orfane (alt user_id).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .or(`endpoint.eq.${data.endpoint},fcm_token.eq.${data.endpoint}`);

      // Retry: insert curat.
      const retry = await context.supabase.from("push_subscriptions").insert(row);
      error = retry.error;
    }

    if (error) throw error;

    // Loghează consimțământul push (acordare). Vezi consent-registry + AGENTS.md.
    await context.supabase.rpc("record_consent", {
      _kind: "push_notifications",
      _version: undefined,
      _accepted: true,
    });
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
    // Loghează retragerea consimțământului push.
    await context.supabase.rpc("record_consent", {
      _kind: "push_notifications",
      _version: undefined,
      _accepted: false,
    });
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// FCM (native Android via Capacitor) — same table, kind='fcm'
// ────────────────────────────────────────────────────────────────────────────

const FcmSaveInput = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
  userAgent: z.string().max(500).optional(),
});

export const saveFcmSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FcmSaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      endpoint: data.token, // reuse endpoint column for FCM token
      p256dh: null,
      auth: null,
      user_agent: data.userAgent ?? null,
      platform: data.platform,
      kind: "fcm",
      fcm_token: data.token,
      last_seen_at: new Date().toISOString(),
    };

    let { error } = await context.supabase
      .from("push_subscriptions")
      .upsert(row, { onConflict: "fcm_token" });

    if (error && ((error as { code?: string }).code === "23505" || /duplicate|unique/i.test(error.message ?? ""))) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .or(`endpoint.eq.${data.token},fcm_token.eq.${data.token}`);
      const retry = await context.supabase.from("push_subscriptions").insert(row);
      error = retry.error;
    }
    if (error) throw error;

    await context.supabase.rpc("record_consent", {
      _kind: "push_notifications",
      _version: undefined,
      _accepted: true,
    });
    return { ok: true };
  });

const FcmRemoveInput = z.object({ token: z.string().min(10) });
export const removeFcmSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FcmRemoveInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .or(`fcm_token.eq.${data.token},endpoint.eq.${data.token}`);
    return { ok: true };
  });


const SendInput = z.object({
  toUserId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  url: z.string().max(500).optional(),
  tag: z.string().max(80).optional(),
  /** Logical category — checked against recipient's notification_prefs. */
  category: z.enum(["matches", "messages", "likes", "taps", "events", "marketing"]).optional(),
});

type Prefs = {
  matches?: boolean;
  messages?: boolean;
  likes?: boolean;
  taps?: boolean;
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
    const { sendFcmOne, isFcmConfigured } = await import("./fcm-push.server");

    // Respect recipient preferences (master toggle, per-category, quiet hours,
    // discrete mode, show_preview). FAIL-CLOSED: dacă nu putem citi
    // preferințele destinatarului, NU trimitem preview — nici măcar generic
    // dacă profilul lipsește complet.
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("notification_prefs, tz_offset_minutes, discrete_mode")
      .eq("id", data.toUserId)
      .maybeSingle();

    if (profileErr || !profile) {
      // Preferințele destinatarului sunt necunoscute → nu riscăm scurgere de
      // preview. Renunțăm complet la dispatch.
      return { delivered: 0, skipped: "prefs_unknown" as const };
    }

    const prefs = (profile.notification_prefs ?? {}) as Prefs & { show_preview?: boolean };
    if (prefs.master_push === false) return { delivered: 0, skipped: "master_off" as const };
    if (data.category && prefs[data.category] === false) {
      return { delivered: 0, skipped: "category_off" as const };
    }
    if (inQuietWindow(prefs, profile.tz_offset_minutes ?? 0)) {
      return { delivered: 0, skipped: "quiet_hours" as const };
    }

    // Preview permis DOAR dacă destinatarul are explicit `show_preview=true`
    // ȘI NU este în mod discret. Orice altă valoare (undefined, false, mod
    // discret) → generic. Fail-closed pe preview.
    const showPreview = prefs.show_preview === true && profile.discrete_mode !== true;
    const rawTitle = showPreview ? data.title : "Ventuza";
    const rawBody = showPreview ? data.body : "Ai o notificare nouă";

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,kind")
      .eq("user_id", data.toUserId);

    if (!subs?.length) return { delivered: 0 };

    const kindForLog = (data.category ?? "generic") as string;

    // Filtru central: mascăm/eliminăm orice câmp sensibil ÎNAINTE să iasă
    // payload-ul din server (indiferent de canal — web push sau FCM).
    const safePayload = sanitizeNotificationPayload({
      title: rawTitle,
      body: rawBody,
      url: profile?.discrete_mode ? undefined : data.url,
      tag: data.tag,
      type: data.category,
      category: data.category,
    });

    let delivered = 0;
    const expired: string[] = [];
    const fcmConfigured = isFcmConfigured();
    for (const s of subs) {
      if (!s.endpoint) continue;
      const payload = {
        title: safePayload.title,
        body: safePayload.body,
        url: safePayload.url,
        tag: safePayload.tag,
        type: safePayload.type,
      };

      if (s.kind === "fcm") {
        if (!fcmConfigured) continue;
        const r = await sendFcmOne({ id: s.id, endpoint: s.endpoint }, payload);
        if (r.ok) {
          delivered++;
          try {
            await supabaseAdmin.rpc("log_notification_dispatch", {
              _actor: context.userId,
              _target: data.toUserId,
              _kind: kindForLog,
              _channel: "fcm",
            });
          } catch {
            /* logging must never block dispatch */
          }
        } else if (r.gone) expired.push(s.id);
      } else if (s.kind === "webpush") {
        const r = await sendOne(
          { id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          payload,
        );
        if (r.ok) {
          delivered++;
          try {
            await supabaseAdmin.rpc("log_notification_dispatch", {
              _actor: context.userId,
              _target: data.toUserId,
              _kind: kindForLog,
              _channel: "webpush",
            });
          } catch {
            /* noop */
          }
        } else if (r.gone) expired.push(s.id);
      }
    }
    if (expired.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
    }
    return { delivered };
  });

