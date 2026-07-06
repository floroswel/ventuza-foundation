/**
 * Guarded PWA service-worker registration.
 *
 * MUST refuse to register in dev, iframe preview, and any Lovable preview host.
 * MUST NOT touch /push-sw.js (dedicated FCM/web-push worker with its own scope).
 */

const APP_SW_URL = "/sw.js";

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  // Vite: dev bundle
  // @ts-expect-error import.meta.env typing
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

export async function registerPwa(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewOrDev()) {
    // Ensure any stale /sw.js from a previous prod visit is cleaned up.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const scriptUrl = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
        // Never unregister the push worker.
        if (scriptUrl.endsWith("/push-sw.js")) continue;
        if (scriptUrl.endsWith(APP_SW_URL)) await reg.unregister();
      }
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await navigator.serviceWorker.register(APP_SW_URL, { scope: "/" });
  } catch (err) {
    // Don't crash the app on SW failure — offline is best-effort.
    // eslint-disable-next-line no-console
    console.warn("[pwa] registration failed", err);
  }
}
