/**
 * Detectarea unei versiuni mai noi publicate în Google Play.
 *
 * Sursa de adevăr este `https://suzeta.app/app-version.json`, generat din
 * `release/version.json` (vezi scripts/write-version-asset.mjs) și publicat
 * odată cu web-ul. Pipeline-ul Android urcă în Play exact acel versionCode,
 * deci dacă remote > local înseamnă că userul are un build vechi.
 *
 * Zero date personale trimise: e un simplu GET pe un fișier static.
 */
import { APP_VERSION_CODE, APP_VERSION, detectPlatform } from "@/lib/app-version";

const VERSION_URL = "https://suzeta.app/app-version.json";
const DISMISS_KEY = "suzeta.update_dismissed_code";
const CHECK_TIMEOUT_MS = 6000;

export type RemoteVersion = {
  versionName: string;
  versionCode: number;
  notes?: string;
};

export function dismissUpdate(code: number) {
  try {
    localStorage.setItem(DISMISS_KEY, String(code));
  } catch {
    /* noop */
  }
}

function isDismissed(code: number): boolean {
  try {
    return Number.parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) >= code;
  } catch {
    return false;
  }
}

/**
 * Întoarce versiunea remote dacă este strict mai nouă decât build-ul instalat
 * și userul nu a respins deja exact acel versionCode. Altfel `null`.
 */
export async function checkForAppUpdate(): Promise<RemoteVersion | null> {
  // Doar pe nativ: pe web nu există „instalare veche”, browserul ia mereu
  // ultimul bundle.
  if (detectPlatform() !== "android" && detectPlatform() !== "ios") return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RemoteVersion;
    const code = Number(data?.versionCode);
    if (!Number.isFinite(code)) return null;
    if (code <= APP_VERSION_CODE) return null;
    if (isDismissed(code)) return null;
    return { versionName: String(data.versionName || ""), versionCode: code, notes: data.notes };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export { APP_VERSION, APP_VERSION_CODE };
