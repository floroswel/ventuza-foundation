/**
 * Partner broadcasts — server functions.
 *
 * Toată logica critică e în DB (RPC `partner_send_broadcast` +
 * `partner_broadcast_quota_status` + `partner_list_my_broadcasts`):
 *   - verifică plan activ non-Free,
 *   - verifică venue owner + aprobat,
 *   - respectă opt-in-ul user-ilor (`partner_announcements_enabled`),
 *   - respectă cooldown 24h per user, cap total 5000/mesaj,
 *   - respectă cota săptămânală per plan (config în `app_settings.partner_broadcast_quotas`).
 *
 * După crearea broadcast-ului, `dispatchPartnerBroadcast` livrează efectiv
 * pe canalele consimțite:
 *   - **push** (web push / FCM / APNs prin web-push) către useri cu
 *     `push_notifications` acordat și `master_push !== false` și în afara
 *     quiet hours,
 *   - **fallback email** DOAR pentru useri cu `marketing` consimțit activ
 *     care nu au primit push (fără subscription, quiet hours, master off etc.).
 * `partner_announcements` este canalul-produs (opt-in pentru a primi anunțuri
 * de la parteneri, indiferent de canal). Consimțământul canalului (push /
 * marketing) e verificat separat pentru fiecare user.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z.object({
  title: z.string().min(4).max(80),
  body: z.string().min(10).max(280),
  targetKind: z.enum(["online", "nearby", "followers", "city"]),
  venueId: z.string().uuid().optional().nullable(),
  radiusM: z.number().int().min(250).max(10000).optional(),
  city: z.string().max(80).optional().nullable(),
  deepLink: z.string().max(200).optional().nullable(),
});

type Prefs = {
  master_push?: boolean;
  events?: boolean;
  marketing?: boolean;
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
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/**
 * Cheie ultimul consimțământ per (user, kind) — helper intern.
 */
async function activeConsentSet(
  admin: any,
  userIds: string[],
  kind: "push_notifications" | "marketing",
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data } = await admin
    .from("consent_log")
    .select("user_id, accepted, created_at")
    .eq("kind", kind)
    .in("user_id", userIds)
    .order("created_at", { ascending: false });
  const seen = new Map<string, boolean>();
  for (const row of (data ?? []) as Array<{ user_id: string; accepted: boolean }>) {
    if (!seen.has(row.user_id)) seen.set(row.user_id, !!row.accepted);
  }
  const out = new Set<string>();
  for (const [uid, ok] of seen) if (ok) out.add(uid);
  return out;
}

/**
 * Livrare push + fallback email pentru un broadcast deja creat.
 * Sursa de adevăr a destinatarilor = rândurile din `notifications` cu
 * `entity_id = broadcastId AND actor_id = partnerId AND type = 'partner_broadcast'`.
 */
async function deliverBroadcast(params: {
  broadcastId: string;
  partnerId: string;
}): Promise<{ push: number; emails: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendOne } = await import("./web-push.server");

  // 1) Meta broadcast (title/body/deep_link) — folosite atât în push cât și în email.
  const { data: broadcast } = await supabaseAdmin
    .from("partner_broadcasts")
    .select("id, partner_id, title, body, deep_link, venue_id")
    .eq("id", params.broadcastId)
    .maybeSingle();
  if (!broadcast) return { push: 0, emails: 0 };
  if (broadcast.partner_id !== params.partnerId) return { push: 0, emails: 0 };

  const link =
    broadcast.deep_link ??
    (broadcast.venue_id ? `/venues/${broadcast.venue_id}` : "/explore");

  // 2) Recipienți din notificările abia create.
  const { data: recipRows } = await supabaseAdmin
    .from("notifications")
    .select("user_id")
    .eq("entity_id", params.broadcastId)
    .eq("actor_id", params.partnerId)
    .eq("type", "partner_broadcast");

  const recipientIds = Array.from(
    new Set((recipRows ?? []).map((r: { user_id: string }) => r.user_id)),
  );
  if (recipientIds.length === 0) return { push: 0, emails: 0 };

  // 3) Consimțăminte active per canal (sursa de adevăr = `consent_log`).
  const [pushConsented, marketingConsented] = await Promise.all([
    activeConsentSet(supabaseAdmin, recipientIds, "push_notifications"),
    activeConsentSet(supabaseAdmin, recipientIds, "marketing"),
  ]);

  // 4) Preferințe user (master_push, quiet hours, discrete_mode) + email fallback.
  const { data: profileRows } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, notification_prefs, tz_offset_minutes, discrete_mode, deleted_at, banned_at",
    )
    .in("id", recipientIds);

  const profiles = new Map<string, any>();
  for (const p of profileRows ?? []) profiles.set(p.id as string, p);

  // 5) Push subscriptions grupate per user (doar webpush activ).
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, kind")
    .in("user_id", recipientIds);

  const subsByUser = new Map<string, Array<any>>();
  for (const s of subs ?? []) {
    if (s.kind && s.kind !== "webpush") continue;
    if (!s.endpoint || !s.p256dh || !s.auth) continue;
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push(s);
    subsByUser.set(s.user_id, arr);
  }

  // 6) Trimit push, colectez cine NU a primit → candidați email fallback.
  const expired: string[] = [];
  let pushDelivered = 0;
  const emailFallbackTargets: string[] = [];

  for (const uid of recipientIds) {
    const profile = profiles.get(uid);
    if (!profile || profile.deleted_at || profile.banned_at) continue;

    const prefs = (profile.notification_prefs ?? {}) as Prefs;
    const canPush =
      pushConsented.has(uid) &&
      prefs.master_push !== false &&
      prefs.events !== false && // partner announcements = categorie "events"
      !inQuietWindow(prefs, profile.tz_offset_minutes ?? 0);

    const userSubs = subsByUser.get(uid) ?? [];
    let deliveredForUser = false;

    if (canPush && userSubs.length > 0) {
      const title = profile.discrete_mode ? "Suzeta" : broadcast.title;
      const body = profile.discrete_mode ? "Ai o notificare nouă" : broadcast.body;
      for (const s of userSubs) {
        const r = await sendOne(
          { id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          {
            title,
            body,
            url: profile.discrete_mode ? undefined : link,
            tag: `broadcast:${params.broadcastId}`,
          },
        );
        if (r.ok) {
          deliveredForUser = true;
        } else if (r.gone) {
          expired.push(s.id);
        }
      }
    }

    if (deliveredForUser) {
      pushDelivered++;
    } else if (marketingConsented.has(uid)) {
      emailFallbackTargets.push(uid);
    }
  }

  // Curățăm subscription-urile moarte.
  if (expired.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
  }

  // 7) Fallback email → coadă `transactional_emails`. Doar cu consimțământ marketing.
  let emailsQueued = 0;
  if (emailFallbackTargets.length > 0) {
    // Adresele de email vin din auth.users; folosim admin.
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailByUser = new Map<string, string>();
    for (const u of authUsers?.users ?? []) {
      if (u.id && u.email) emailByUser.set(u.id, u.email);
    }

    const SENDER_DOMAIN = "notify.suzeta.app";
    const FROM = "Suzeta <noreply@suzeta.ro>";
    const subject = `Suzeta: ${broadcast.title}`;
    const safeTitle = escapeHtml(broadcast.title);
    const safeBody = escapeHtml(broadcast.body).replace(/\n/g, "<br/>");
    const linkAbs = link.startsWith("http")
      ? link
      : `https://suzeta.app${link.startsWith("/") ? "" : "/"}${link}`;

    for (const uid of emailFallbackTargets) {
      const to = emailByUser.get(uid);
      if (!to) continue;
      const messageId = crypto.randomUUID();

      // Log pending
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "partner_broadcast",
        recipient_email: to,
        status: "pending",
      });

      const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b0f;color:#f4f4f5;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#17171f;border-radius:12px;padding:24px">
  <h2 style="margin:0 0 12px;color:#fff">${safeTitle}</h2>
  <p style="margin:0 0 20px;color:#d4d4d8;line-height:1.5">${safeBody}</p>
  <p><a href="${linkAbs}" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Deschide în Suzeta</a></p>
  <hr style="border:0;border-top:1px solid #27272a;margin:24px 0"/>
  <p style="font-size:12px;color:#a1a1aa">
    Primești acest email pentru că ai activat comunicări marketing în Suzeta.
    <a href="https://suzeta.app/settings" style="color:#a1a1aa">Dezactivează</a>
  </p>
</div></body></html>`;

      const text = `${broadcast.title}\n\n${broadcast.body}\n\n${linkAbs}\n\nDezactivezi din Setări → Comunicări.`;

      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to,
          from: FROM,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "partner_broadcast",
          queued_at: new Date().toISOString(),
        },
      });

      if (enqErr) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "partner_broadcast",
          recipient_email: to,
          status: "failed",
          error_message: enqErr.message,
        });
      } else {
        emailsQueued++;
      }
    }
  }

  // 8) Actualizează contoarele pe broadcast.
  await supabaseAdmin
    .from("partner_broadcasts")
    .update({ push_delivered: pushDelivered, emails_queued: emailsQueued })
    .eq("id", params.broadcastId);

  return { push: pushDelivered, emails: emailsQueued };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const partnerSendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof SendSchema>) => SendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: result, error } = await sb.rpc("partner_send_broadcast", {
      p_title: data.title,
      p_body: data.body,
      p_target_kind: data.targetKind,
      p_venue_id: data.venueId ?? null,
      p_radius_m: data.radiusM ?? 10000,
      p_city: data.city ?? null,
      p_deep_link: data.deepLink ?? null,
    });
    if (error) throw new Error(error.message);
    const rpc = result as {
      ok: boolean;
      broadcast_id: string;
      recipients: number;
      remaining: number;
    };

    // Livrare push + fallback email (best-effort; erori individuale sunt logate,
    // dar nu blochează răspunsul către partener — notificările in-app sunt deja create).
    let dispatch = { push: 0, emails: 0 };
    try {
      dispatch = await deliverBroadcast({
        broadcastId: rpc.broadcast_id,
        partnerId: context.userId,
      });
    } catch (e) {
      console.error("[partnerSendBroadcast] dispatch failed", e);
    }

    return {
      ...rpc,
      push_delivered: dispatch.push,
      emails_queued: dispatch.emails,
    };
  });

export const partnerBroadcastQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("partner_broadcast_quota_status");
    if (error) throw new Error(error.message);
    return data as {
      plan_code: string;
      active: boolean;
      weekly_cap: number;
      used_7d: number;
      remaining: number;
      max_radius_m: number;
      max_recipients_per_send: number;
      min_body_len: number;
      max_body_len: number;
      min_title_len: number;
      max_title_len: number;
      user_cooldown_hours: number;
    };
  });

export const partnerListMyBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("partner_list_my_broadcasts", { _limit: 50 });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      venue_id: string | null;
      title: string;
      body: string;
      target_kind: string;
      radius_m: number | null;
      city: string | null;
      recipients_delivered: number;
      recipients_targeted: number;
      status: string;
      created_at: string;
      sent_at: string | null;
    }>;
  });

/** Listez venue-urile aprobate ale partenerului pentru dropdown-ul de trimitere. */
export const partnerListApprovedVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("venues")
      .select("id, name, city, moderation_status, is_published")
      .eq("owner_id", context.userId)
      .eq("moderation_status", "approved")
      .eq("is_published", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; city: string | null }>;
  });
