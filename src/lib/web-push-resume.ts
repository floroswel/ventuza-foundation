/**
 * Re-attaches the browser's Web Push subscription at every app start for users
 * who already granted permission. Fără asta, abonamentul exista doar în
 * sesiunea în care s-a apăsat „Activează notificările”, iar dacă salvarea în
 * DB eșuase (sau endpoint-ul a fost rotit de browser), userul nu mai primea
 * niciodată push cu aplicația închisă.
 *
 * NU cere permisiunea — dacă nu e deja `granted`, iese tăcut.
 */
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/web-push-config";

type SaveFn = (args: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}) => Promise<unknown>;

export async function resumeWebPush(save: SaveFn): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return false;
  if (Notification.permission !== "granted") return false;

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration("/push-sw.js")) ??
      (await navigator.serviceWorker.register("/push-sw.js"));
    await navigator.serviceWorker.ready;

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      }));

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    await save({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent.slice(0, 500),
    });
    return true;
  } catch (e) {
    console.warn("[push] resumeWebPush failed", e);
    return false;
  }
}
