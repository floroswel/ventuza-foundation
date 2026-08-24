/**
 * Legătura dintre site și aplicația din Google Play.
 *
 * Suzeta este publicată pe Play, deci un vizitator de pe Android care ajunge pe
 * suzeta.app trebuie să afle că există aplicația nativă — nu varianta instalabilă
 * din browser (PWA), care arată la fel dar nu are notificări native, tastatură
 * corectă sau deep link-uri.
 *
 * Logica stă separat de componentă ca să poată fi testată fără DOM.
 */

/** Package ID-ul din Play. Aceeași valoare ca în `assetlinks.json` și Capacitor. */
export const PLAY_PACKAGE_ID = "app.suzeta";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_ID}`;

/** Cheia sub care ținem minte că utilizatorul a închis bannerul. */
export const INSTALL_DISMISSED_KEY = "suzeta.install_banner_dismissed";

export type InstallContext = {
  /** Rulează deja în aplicația nativă (Capacitor). */
  isNative: boolean;
  /** `navigator.userAgent` — folosit DOAR pentru a alege cât de vizibil e mesajul. */
  userAgent: string;
  /** Utilizatorul a închis deja bannerul. */
  dismissed: boolean;
};

/**
 * Android, dar nu în aplicația noastră.
 *
 * Excludem explicit WebView-ul Capacitor: în aplicație, un banner „descarcă
 * aplicația” ar fi absurd. `wv` și numele pachetului sunt semnalele uzuale.
 */
export function isAndroidBrowser(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  if (!ua.includes("android")) return false;
  // WebView-ul aplicației native — nu e un browser unde are sens invitația.
  if (ua.includes("; wv)") || ua.includes(PLAY_PACKAGE_ID)) return false;
  return true;
}

/**
 * Bannerul apare doar pe Android, în browser, dacă nu a fost închis.
 *
 * Pe desktop și iOS nu deranjăm cu un banner: link-ul rămâne disponibil
 * permanent în subsol, unde nu ocupă spațiu și nu întrerupe pe nimeni.
 */
export function shouldShowInstallBanner(ctx: InstallContext): boolean {
  if (ctx.isNative) return false;
  if (ctx.dismissed) return false;
  return isAndroidBrowser(ctx.userAgent);
}

/**
 * Link-ul permanent (subsol) se arată oricui NU e deja în aplicație —
 * inclusiv pe desktop, de unde oamenii caută adesea aplicația pentru telefon.
 */
export function shouldShowStoreLink(ctx: Pick<InstallContext, "isNative">): boolean {
  return !ctx.isNative;
}
