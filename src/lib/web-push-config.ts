// VAPID public key — safe to ship to the browser.
// Pair with VAPID_PRIVATE_KEY (server-only, in src/lib/web-push.server.ts).
export const VAPID_PUBLIC_KEY =
  "BOO0M7jilN8SYJCuFoiFqzfWYzRdcadEhpZbuhIZG5Iz8fYwGzYLjcqZ1nUGrwX5p4EHDwYNVT5AH5HWfEpABto";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
