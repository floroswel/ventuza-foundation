/**
 * Recuperare permanentă din erorile de tip "stale chunk".
 *
 * După fiecare publicare, fișierele JS primesc hash-uri noi. Un tab / PWA /
 * WebView care mai are în cache HTML-ul vechi cere chunk-uri care nu mai
 * există (404) → importul dinamic al rutei eșuează → error boundary
 * ("This page didn't load").
 *
 * Soluția: detectăm acest tip specific de eroare, curățăm cache-urile și
 * reîncărcăm o singură dată (guard în sessionStorage ca să nu intrăm în buclă).
 */

const GUARD_KEY = "suzeta:chunk-reload-at";
const GUARD_WINDOW_MS = 30_000;

const PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
  "failed to load module script",
  "'text/html' is not a valid javascript mime type",
  "expected a javascript module script",
  "dynamically imported module",
  "chunkloaderror",
];

export function isStaleChunkError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  if (!message) return false;
  const lower = message.toLowerCase();
  return PATTERNS.some((p) => lower.includes(p));
}

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(GUARD_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Curăță cache-urile de build și reîncarcă pagina o singură dată. */
export async function recoverFromStaleChunk(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (recentlyReloaded()) return false;
  markReloaded();

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const url =
          reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? "";
        // Nu atingem worker-ul de push.
        if (url.endsWith("/push-sw.js")) continue;
        await reg.unregister();
      }
    }
  } catch {
    /* ignore */
  }

  // Reload forțat de pe rețea, păstrând ruta curentă.
  window.location.reload();
  return true;
}

let installed = false;

/** Instalează listenerii globali (idempotent, doar în browser). */
export function installChunkRecovery(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const handle = (err: unknown) => {
    if (isStaleChunkError(err)) void recoverFromStaleChunk();
  };

  window.addEventListener("vite:preloadError", (event) => {
    // Vite emite acest eveniment când un modul preîncărcat nu poate fi adus.
    event.preventDefault();
    void recoverFromStaleChunk();
  });
  window.addEventListener("error", (event) => handle(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => handle(event.reason));
}
