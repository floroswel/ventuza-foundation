/**
 * Linkuri către magazinele de aplicații + detecție platformă pentru web.
 *
 * Scop: vizitatorii de pe suzeta.app (web) sunt trimiși în aplicația nativă
 * dacă e instalată (Android App Links / iOS Universal Links), altfel în
 * Google Play (Android) sau App Store (iOS). Atribuirea se măsoară separat:
 * `app_link_open` (link universal) vs `intent_open` (intent Android) vs
 * `store_click`.
 */

import {
  readUtmParams,
  sanitizeDeepLinkPath,
  stashDeferredDeepLink,
} from "@/lib/deferred-deeplink";
import {
  UTM_CAMPAIGN,
  UTM_MEDIUM,
  trackStoreFunnel,
  trackAppLinkOpen,
  type StoreClickSource,
} from "@/lib/store-analytics";

export const ANDROID_PACKAGE = "app.suzeta";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** ID-ul numeric App Store (setat prin env când aplicația iOS e publicată). */
export const APPLE_APP_ID = (import.meta.env['VITE_APPLE_APP_ID'] as string | undefined) ?? "";
export const APP_STORE_URL = APPLE_APP_ID
  ? `https://apps.apple.com/app/id${APPLE_APP_ID}`
  : "https://apps.apple.com/search?term=suzeta";

export const SITE_ORIGIN = "https://suzeta.app";

/**
 * Referrer-ul UTM efectiv trimis către magazin (afișat și în modul debug).
 *
 * Când primim o cale țintă, o codificăm în `dl` ca deep link-ul să supraviețuiască
 * instalării: Google Play livrează acest referrer aplicației prin Install Referrer.
 * UTM-urile cu care a venit vizitatorul pe site au prioritate față de valorile
 * implicite, ca atribuirea campaniei externe să nu se piardă.
 */
export function storeReferrer(
  source: StoreClickSource | string = "web",
  path?: string,
): string {
  const inbound = readUtmParams();
  const params = new URLSearchParams({
    utm_source: inbound['utm_source'] ?? source,
    utm_medium: inbound['utm_medium'] ?? UTM_MEDIUM,
    utm_campaign: inbound['utm_campaign'] ?? UTM_CAMPAIGN,
  });
  for (const key of ["utm_content", "utm_term", "gclid", "ref"]) {
    const v = inbound[key];
    if (v) params.set(key, v);
  }
  // Sursa butonului rămâne mereu vizibilă, chiar dacă utm_source vine din campanie.
  params.set("cta", String(source));
  const target = sanitizeDeepLinkPath(path ?? null);
  if (target) params.set("dl", target);
  return params.toString();
}

/**
 * Linkul Play Store cu atribuire. Google Play acceptă un singur parametru
 * `referrer`, care conține la rândul lui un query-string UTM; Play Console îl
 * raportează în „Acquisition → Traffic sources”, iar Install Referrer API îl
 * expune aplicației după instalare.
 */
export function playStoreUrl(
  source: StoreClickSource | string = "web",
  path?: string,
): string {
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(storeReferrer(source, path))}`;
}

/** App Store cu parametrii de campanie (Apple: `pt`/`ct`/`mt`). */
export function appStoreUrl(
  source: StoreClickSource | string = "web",
  path?: string,
): string {
  const sep = APP_STORE_URL.includes("?") ? "&" : "?";
  const target = sanitizeDeepLinkPath(path ?? null);
  const params = new URLSearchParams({
    ct: `${UTM_CAMPAIGN}_${source}${target ? `_${target.replace(/\//g, "-")}` : ""}`.slice(0, 100),
    mt: "8",
  });
  return `${APP_STORE_URL}${sep}${params.toString()}`;
}

/** Intent Android care deschide direct aplicația Play Store (fallback pe web). */
export const PLAY_STORE_MARKET_URL = `market://details?id=${ANDROID_PACKAGE}`;

/** True doar în browser pe Android (nu în wrapper-ul nativ Capacitor). */
export function isAndroidWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return false;
  if (typeof window !== "undefined") {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (w.Capacitor?.isNativePlatform?.()) return false;
    if (window.location.protocol === "capacitor:") return false;
  }
  return true;
}

/** True doar în browser pe iOS (nu în wrapper-ul nativ). */
export function isIosWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  if (!isIos) return false;
  if (typeof window !== "undefined") {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (w.Capacitor?.isNativePlatform?.()) return false;
    if (window.location.protocol === "capacitor:") return false;
  }
  return true;
}

/** True pe mobil (Android sau iOS) în browser. */
export function isMobileWebBrowser(): boolean {
  return isAndroidWebBrowser() || isIosWebBrowser();
}

/** Magazinul potrivit platformei curente. */
export function storeUrlForPlatform(
  source: StoreClickSource | string = "web",
  path?: string,
): string {
  return isIosWebBrowser() ? appStoreUrl(source, path) : playStoreUrl(source, path);
}

type RelatedApp = { platform?: string; id?: string; url?: string };

/**
 * Detectează dacă aplicația e deja instalată pe device.
 *
 * Folosește `navigator.getInstalledRelatedApps()` (Chrome Android), care
 * funcționează pe baza `related_applications` din manifest + Digital Asset
 * Links (`/.well-known/assetlinks.json`). Dacă API-ul nu există (ex. iOS
 * Safari), întoarce `null` = necunoscut (nu „nu e instalată”).
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
export function androidIntentUrl(path = "/", source: StoreClickSource | string = "web"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const fallback = encodeURIComponent(playStoreUrl(source, clean));
  return (
    `intent://suzeta.app${clean}#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

/** Universal Link iOS: același URL https, deschis de sistem în aplicație. */
export function universalLinkUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${clean}`;
}

/**
 * Deschide aplicația instalată sau magazinul potrivit platformei, măsurând
 * evenimentul de funnel înainte de navigare.
 *
 * - Android: `intent://` (fallback automat pe Play) → `intent_open` sau `store_click`.
 * - iOS: Universal Link; dacă sistemul nu preia linkul în ~1.2s, ducem userul
 *   în App Store → `app_link_open` apoi eventual `store_click`.
 * - Desktop: direct magazinul.
 */
export function openAppOrStore(
  path = "/",
  source: StoreClickSource | string = "web",
  appInstalled: boolean | null = null,
  variant: string | null = null,
): void {
  if (typeof window === "undefined") return;
  const referrer = storeReferrer(source, path);
  // Deferred deep link: dacă userul instalează acum, prima deschidere a
  // aplicației trebuie să aterizeze pe aceeași pagină, cu aceleași UTM-uri.
  stashDeferredDeepLink(path, readUtmParams(), "web_click");

  if (isAndroidWebBrowser()) {
    trackStoreFunnel(appInstalled ? "intent_open" : "store_click", {
      source,
      path,
      appInstalled,
      variant,
      referrer,
    });
    window.location.href = androidIntentUrl(path, source);
    return;
  }

  if (isIosWebBrowser()) {
    trackAppLinkOpen(path, { source, appInstalled, variant, referrer });
    const startedAt = Date.now();
    const store = appStoreUrl(source, path);
    const timer = window.setTimeout(() => {
      // Dacă suntem încă în pagină (aplicația nu a preluat Universal Link-ul),
      // trimitem userul în App Store.
      if (document.visibilityState === "visible" && Date.now() - startedAt >= 1100) {
        trackStoreFunnel("store_click", { source, path, appInstalled, variant, referrer });
        window.location.href = store;
      }
    }, 1200);
    const cancel = () => window.clearTimeout(timer);
    window.addEventListener("pagehide", cancel, { once: true });
    document.addEventListener("visibilitychange", cancel, { once: true });
    window.location.href = universalLinkUrl(path);
    return;
  }

  trackStoreFunnel("store_click", { source, path, appInstalled, variant, referrer });
  window.open(storeUrlForPlatform(source, path), "_blank", "noopener,noreferrer");
}
