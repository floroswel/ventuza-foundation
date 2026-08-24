/**
 * Linkuri către magazinele de aplicații + detecție platformă pentru web.
 *
 * Scop: vizitatorii de pe suzeta.app (web) sunt trimiși să instaleze aplicația
 * nativă din Google Play, nu să folosească varianta din browser / PWA.
 */

import {
  UTM_CAMPAIGN,
  UTM_MEDIUM,
  trackStoreFunnel,
  type StoreClickSource,
} from "@/lib/store-analytics";

export const ANDROID_PACKAGE = "app.suzeta";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Linkul Play Store cu atribuire. Google Play acceptă un singur parametru
 * `referrer`, care conține la rândul lui un query-string UTM; Play Console îl
 * raportează în „Acquisition → Traffic sources”, iar Install Referrer API îl
 * expune aplicației după instalare.
 */
export function playStoreUrl(source: StoreClickSource | string = "web"): string {
  const referrer = new URLSearchParams({
    utm_source: source,
    utm_medium: UTM_MEDIUM,
    utm_campaign: UTM_CAMPAIGN,
  }).toString();
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}

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

type RelatedApp = { platform?: string; id?: string; url?: string };

/**
 * Detectează dacă aplicația Android e deja instalată pe device.
 *
 * Folosește `navigator.getInstalledRelatedApps()` (Chrome Android), care
 * funcționează pe baza `related_applications` din manifest + Digital Asset
 * Links (`/.well-known/assetlinks.json`). Dacă API-ul nu există, întoarce
 * `null` = necunoscut (nu „nu e instalată”).
 */
export async function isAndroidAppInstalled(): Promise<boolean | null> {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
  };
  if (typeof nav.getInstalledRelatedApps !== "function") return null;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((a) => a.platform === "play" && a.id === ANDROID_PACKAGE);
  } catch {
    return null;
  }
}

/**
 * URL `intent://` care deschide aplicația nativă dacă e instalată, iar dacă nu,
 * cade automat pe Google Play (`S.browser_fallback_url`). Un singur click,
 * fără timere fragile.
 */
export function androidIntentUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return (
    `intent://suzeta.app${clean}#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

/**
 * Deschide aplicația instalată (prin intent) sau Google Play.
 * Pe non-Android / desktop merge direct la Play Store.
 */
export function openAppOrStore(path = "/"): void {
  if (typeof window === "undefined") return;
  if (isAndroidWebBrowser()) {
    window.location.href = androidIntentUrl(path);
    return;
  }
  window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
}

