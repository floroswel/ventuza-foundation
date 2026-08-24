/**
 * Linkuri către magazinele de aplicații + detecție platformă pentru web.
 *
 * Scop: vizitatorii de pe suzeta.app (web) sunt trimiși să instaleze aplicația
 * nativă din Google Play, nu să folosească varianta din browser / PWA.
 */

export const ANDROID_PACKAGE = "app.suzeta";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Intent Android care deschide direct aplicația Play Store (fallback pe web). */
export const PLAY_STORE_MARKET_URL = `market://details?id=${ANDROID_PACKAGE}`;

/** True doar în browser pe Android (nu în wrapper-ul nativ Capacitor). */
export function isAndroidWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return false;
  // Wrapper-ul Capacitor injectează un UA cu "wv" sau rulează pe capacitor://
  if (typeof window !== "undefined") {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (w.Capacitor?.isNativePlatform?.()) return false;
    if (window.location.protocol === "capacitor:") return false;
  }
  return true;
}

/** True pe mobil (Android sau iOS) în browser. */
export function isMobileWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
