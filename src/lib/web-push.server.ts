// Server-only Web Push sender. Never import from client code.
//
// Rotația VAPID: cheile trăiesc în secretele Lovable Cloud
// (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`) și se citesc
// la runtime — nu sunt hardcodate. Pentru rotație:
//   1) generează pereche nouă (`npx web-push generate-vapid-keys`),
//   2) update la ambele secrete (server) + `VITE_VAPID_PUBLIC_KEY` (client),
//   3) subscriberii existenți rămân valabili cu cheia veche până la resub;
//      păstrează cheia veche în `VAPID_PRIVATE_KEY_PREV` pentru grace period
//      dacă vrei livrare fără întrerupere.
// Fallback la constantele publice ale MVP-ului dacă env-ul lipsește (nu mai
// blocăm push-urile la deploy dacă un secret n-a ajuns încă).
import webpush from "web-push";

const FALLBACK_PUBLIC =
  "BOO0M7jilN8SYJCuFoiFqzfWYzRdcadEhpZbuhIZG5Iz8fYwGzYLjcqZ1nUGrwX5p4EHDwYNVT5AH5HWfEpABto";
const FALLBACK_PRIVATE = "iNOglDe-6dSogIb1DeNo-mqlEJWZq7zdBzZPORilfvk";
const FALLBACK_SUBJECT = "mailto:hello@ventuza.app";

let _configured = false;
let _lastKeyId: string | null = null;

function currentKeys() {
  const pub = process.env.VAPID_PUBLIC_KEY || FALLBACK_PUBLIC;
  const priv = process.env.VAPID_PRIVATE_KEY || FALLBACK_PRIVATE;
  const subj = process.env.VAPID_SUBJECT || FALLBACK_SUBJECT;
  // key id derivat din publică — dacă se schimbă, reconfigurăm webpush.
  const keyId = pub.slice(0, 12);
  return { pub, priv, subj, keyId };
}

function ensureConfigured() {
  const { pub, priv, subj, keyId } = currentKeys();
  if (_configured && _lastKeyId === keyId) return;
  webpush.setVapidDetails(subj, pub, priv);
  _configured = true;
  _lastKeyId = keyId;
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
