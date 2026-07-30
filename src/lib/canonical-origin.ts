/**
 * Origine canonică pentru fluxurile OAuth.
 *
 * De ce: brokerul OAuth derivă `redirect_uri` și `app_domain` din originea de
 * la care pornește cererea. Dacă userul deschide un domeniu vechi
 * (ventuza.app / www.ventuza.app) sau un WebView nativ cu URL legacy,
 * Google afișează "Continue to ventuza.app". Forțăm o singură origine
 * publică: https://suzeta.app.
 */

export const CANONICAL_ORIGIN = "https://suzeta.app";

const LEGACY_HOSTS = new Set([
  "ventuza.app",
  "www.ventuza.app",
  "ventuza-foundation.lovable.app",
]);

/** Domenii unde forțăm originea canonică (producție). */
export function isLegacyHost(host: string): boolean {
  return LEGACY_HOSTS.has(host.toLowerCase());
}

/** Originea folosită în orice `redirect_uri` OAuth. */
export function oauthOrigin(): string {
  if (typeof window === "undefined") return CANONICAL_ORIGIN;
  const host = window.location.hostname.toLowerCase();
  if (isLegacyHost(window.location.host)) return CANONICAL_ORIGIN;
  if (host === "suzeta.app" || host === "www.suzeta.app") return CANONICAL_ORIGIN;
  // dev / preview / capacitor: păstrăm originea locală
  return window.location.origin;
}

/**
 * Redirecționează hard către domeniul canonic dacă rulăm pe un host legacy.
 * Se apelează o singură dată, cât mai devreme (root effect).
 */
export function enforceCanonicalHost(): void {
  if (typeof window === "undefined") return;
  if (!isLegacyHost(window.location.host)) return;
  const target = CANONICAL_ORIGIN + window.location.pathname + window.location.search + window.location.hash;
  window.location.replace(target);
}
