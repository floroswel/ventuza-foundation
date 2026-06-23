// Server-only Web Push sender. Never import from client code.
// TODO: rotate VAPID_PRIVATE_KEY via secrets when leaving MVP.
import webpush from "web-push";

const VAPID_PUBLIC =
  "BOO0M7jilN8SYJCuFoiFqzfWYzRdcadEhpZbuhIZG5Iz8fYwGzYLjcqZ1nUGrwX5p4EHDwYNVT5AH5HWfEpABto";
const VAPID_PRIVATE = "iNOglDe-6dSogIb1DeNo-mqlEJWZq7zdBzZPORilfvk";
const VAPID_SUBJECT = "mailto:hello@ventuza.app";

let _configured = false;
function ensureConfigured() {
  if (_configured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  _configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

export type SubscriptionRow = {
  id: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
};

/** Send a push to a single subscription; returns true if delivered, false to prune. */
export async function sendOne(
  sub: SubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  ensureConfigured();
  if (!sub.endpoint || !sub.p256dh || !sub.auth) return { ok: false, gone: true };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}
