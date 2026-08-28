/**
 * Versiunea aplicației, folosită de VersionGate pentru a compara cu
 * `app_settings.min_supported_version` (per platformă). Se incrementează
 * la fiecare release (semver). Nu se cita hardcode în altă parte — importă
 * din acest modul.
 */
// Sincronizat automat cu release/version.json de scripts/bump-android-version.mjs.
export const APP_VERSION = "1.0.67";
// versionCode-ul Android al build-ului curent (întreg strict crescător).
export const APP_VERSION_CODE = 77;

export function detectPlatform(): "web" | "ios" | "android" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  // Capacitor injectează un flag global când rulăm nativ.
  const cap = (globalThis as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const capPlat = cap?.getPlatform?.();
  if (capPlat === "ios" || capPlat === "android") return capPlat;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

/**
 * Comparație semver simplă: întoarce `true` dacă `current` este strict
 * mai mic decât `min`. Formatul acceptat: `X.Y.Z` (segmentele non-numerice
 * sunt tratate ca 0). Sub 3 segmente → normalizat cu zerouri.
 */
export function isBelowMinVersion(current: string, min: string): boolean {
  const parse = (v: string) =>
    (v || "0.0.0")
      .split(".")
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0)
      .concat([0, 0, 0])
      .slice(0, 3);
  const c = parse(current);
  const m = parse(min);
  for (let i = 0; i < 3; i++) {
    if (c[i] < m[i]) return true;
    if (c[i] > m[i]) return false;
  }
  return false;
}
