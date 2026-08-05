/**
 * Protecție anti-screenshot / screen-recording pentru build-ul nativ Android.
 *
 * Default: FLAG_SECURE ACTIV (setat deja în MainActivity.onCreate), deci
 * capturile sunt blocate pe tot ce ține de conținut privat: chat, profile,
 * poze, potriviri, notificări.
 *
 * Excepție: ecranele publice / non-sensibile (landing, legal, ajutor, setări,
 * auth) permit capturi ca userul să poată raporta probleme sau partaja pagini
 * publice.
 */

type ScreenshotBridge = { setScreenshotAllowed?: (allowed: boolean) => void };

/** Rute pe care permitem capturi de ecran (prefix match). */
const SCREENSHOT_ALLOWED_PREFIXES = [
  "/legal",
  "/about",
  "/faq",
  "/contact",
  "/safety",
  "/community-guidelines",
  "/child-safety",
  "/status",
  "/business",
  "/advertise",
  "/partner",
  "/premium",
  "/sale-pitch",
  "/account-deletion",
  "/blocked-region",
];

export function isScreenshotAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return SCREENSHOT_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function bridge(): ScreenshotBridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { SuzetaSignature?: ScreenshotBridge }).SuzetaSignature;
  return typeof b?.setScreenshotAllowed === "function" ? b : null;
}

/** Aplică politica pentru ruta curentă. No-op pe web (fără bridge nativ). */
export function applyScreenshotPolicy(pathname: string): void {
  try {
    bridge()?.setScreenshotAllowed?.(isScreenshotAllowedPath(pathname));
  } catch {
    /* best effort — securitatea rămâne pe default-ul nativ (blocat) */
  }
}
