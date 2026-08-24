/**
 * Înregistrează worker-ul care ține cache persistent pentru imaginile de
 * profil (`public/push-sw.js` — același worker face și push-ul).
 *
 * Fără el, fiecare sesiune re-descarcă toate pozele. Nu cere nicio permisiune
 * și nu pornește niciun abonament push — doar instalează worker-ul.
 * Refuzăm dev / preview / iframe, exact ca la restul înregistrărilor SW.
 */

function blocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host.endsWith(".lovableproject.com") || host.endsWith(".lovable.dev")) return true;
  return false;
}

export async function registerImageCacheSw(): Promise<void> {
  if (blocked()) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const already = regs.some((r) =>
      (r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "").endsWith(
        "/push-sw.js",
      ),
    );
    if (already) return;
    await navigator.serviceWorker.register("/push-sw.js");
  } catch {
    /* cache-ul de imagini e un bonus, nu o dependență */
  }
}
