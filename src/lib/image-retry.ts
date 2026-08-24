/**
 * Retry cu backoff exponențial pentru încărcarea imaginilor.
 *
 * De ce: un URL semnat poate expira între momentul cache-ării și momentul
 * randării, iar pe mobil o pierdere scurtă de rețea face `<img>` să eșueze
 * definitiv (browserul nu reîncearcă singur). Aici:
 *   1. invalidăm intrarea din cache-ul de URL-uri semnate,
 *   2. re-semnăm calea (dacă știm bucket + path),
 *   3. reîncercăm cu backoff 400ms → 1.2s → 3s,
 *   4. la epuizare, cădem pe un fallback (avatar placeholder / blur).
 */

const BACKOFF_MS = [400, 1200, 3000];

export const MAX_IMAGE_RETRIES = BACKOFF_MS.length;

export function retryDelay(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 3000;
}

/** Adaugă un parametru de cache-busting, ca browserul să nu servească eroarea din cache. */
export function bustCache(url: string, attempt: number): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "https://x");
    u.searchParams.set("_r", String(attempt));
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + `_r=${attempt}`;
  }
}
