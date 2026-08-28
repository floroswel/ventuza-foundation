/**
 * Nucleul de livrare a notificărilor push. SERVER-ONLY.
 *
 * DE CE E UN MODUL SEPARAT: până acum logica trăia în `push.functions.ts`,
 * care este importat și de client (chat.ts). Asta o făcea apelabilă doar
 * printr-un server function, adică doar dintr-o cerere pornită de pe un
 * telefon. Odată ce baza de date declanșează push-ul singură (vezi
 * `push_outbox` + `tg_notify_new_message`), ruta internă are nevoie de
 * aceeași logică fără să treacă prin stratul de server functions.
 *
 * O SINGURĂ implementare a politicii de confidențialitate — master_push,
 * categorii, ore de liniște, mod discret, gate-ul de preview — folosită de
 * toți apelanții. Un apelant nou nu are cum să o ocolească din greșeală.
 */
import { sanitizeNotificationPayload } from "./notification-privacy";

/** Categoriile verificate față de `notification_prefs` ale destinatarului. */
export type PushCategory =
  | "matches"
  | "messages"
  | "likes"
  | "taps"
  | "events"
  | "marketing";

export type Prefs = {
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

type DispatchArgs = {
  /** Cine declanșează (folosit doar la logare, niciodată în payload). */
  actorId: string;
  toUserId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  category?: PushCategory;
};

/**
 * Nucleul de livrare: preferințele destinatarului, gate-ul de preview și
 * trimiterea pe fiecare abonare (FCM + web push).
 *
 * Folosit de `sendPushToUser` (taps, like-uri, match-uri — declanșate de o
 * acțiune a utilizatorului) ȘI de ruta internă golită de baza de date
 * (mesaje). O singură implementare = o singură politică de confidențialitate,
 * imposibil de ocolit dintr-un apelant nou.
 */
export async function dispatchPush(data: DispatchArgs) {
  const context = { userId: data.actorId };
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
  const rawTitle = showPreview ? data.title : "Suzeta";
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
    // URL-ul rămâne mereu: e o rută internă (ex. /messages/<uuid>), fără
    // conținut personal, și fără el tap-ul pe notificare nu duce la ecranul
    // corect când aplicația e închisă.
    url: data.url,
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
}

