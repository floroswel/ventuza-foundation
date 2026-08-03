/**
 * Detecție sincronă a platformei native (Capacitor).
 *
 * De ce sincron: verificarea async (`await import("@capacitor/core")`) lasă
 * primul render cu `isNative = false`, deci butonul Google apărea o fracțiune
 * de secundă (sau permanent, dacă efectul nu apuca să ruleze) în app-ul nativ.
 * Bridge-ul Capacitor injectează `window.Capacitor` înainte de bootul webview-ului,
 * deci îl putem citi direct la primul render.
 */
export function isNativePlatformSync(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; platform?: string };
  }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  return cap.platform === "android" || cap.platform === "ios";
}
