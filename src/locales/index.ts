// Registru unic de limbi al aplicației.
//
// REGULĂ: o limbă nouă se adaugă DOAR aici — un fișier `src/locales/<cod>.ts`
// + o linie în `APP_LANGUAGES`. Restul aplicației (i18n init, selectorul din
// Setări, toggle-ul din auth, detecția device-ului) citește din acest registru,
// deci nu există liste de limbi hardcodate în altă parte.
//
// Traducerile pot fi parțiale: i18next cade pe engleză cheie-cu-cheie
// (`fallbackLng: "en"`), deci nu apar niciodată chei brute în UI.

// `ro` și `en` se încarcă EAGER: româna este limba principală, iar engleza
// este `fallbackLng` — orice cheie netradusă cade pe ea, deci ambele trebuie
// să existe din primul cadru.
//
// Restul se încarcă LENEȘ. Erau opt dicționare importate static, adică ~52 KB
// pe care fiecare utilizator îi parsa la FIECARE pornire pentru limbi pe care
// nu le va vedea niciodată. În aplicația împachetată nu există gzip: bundle-ul
// se citește local, deci octeții aceia sunt timp de CPU direct, înainte de
// primul pixel.
import { ro } from "./ro";
import { en } from "./en";

import type { PartialDict } from "./types";

export type AppLanguage = "ro" | "en" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl" | "hu";

export type LanguageMeta = {
  code: AppLanguage;
  /** Numele limbii scris în limba respectivă (nu se traduce). */
  nativeName: string;
  /** Etichetă în engleză, pentru admin / loguri. */
  englishName: string;
  flag: string;
  /** true = dicționar complet (toate ecranele). */
  complete: boolean;
};

export const APP_LANGUAGES: readonly LanguageMeta[] = [
  { code: "ro", nativeName: "Română", englishName: "Romanian", flag: "🇷🇴", complete: true },
  { code: "en", nativeName: "English", englishName: "English", flag: "🇬🇧", complete: true },
  { code: "de", nativeName: "Deutsch", englishName: "German", flag: "🇩🇪", complete: false },
  { code: "fr", nativeName: "Français", englishName: "French", flag: "🇫🇷", complete: false },
  { code: "es", nativeName: "Español", englishName: "Spanish", flag: "🇪🇸", complete: false },
  { code: "it", nativeName: "Italiano", englishName: "Italian", flag: "🇮🇹", complete: false },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", flag: "🇵🇹", complete: false },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch", flag: "🇳🇱", complete: false },
  { code: "pl", nativeName: "Polski", englishName: "Polish", flag: "🇵🇱", complete: false },
  { code: "hu", nativeName: "Magyar", englishName: "Hungarian", flag: "🇭🇺", complete: false },
];

export const APP_LANGUAGE_CODES = APP_LANGUAGES.map((l) => l.code) as AppLanguage[];

export function isAppLanguage(code: unknown): code is AppLanguage {
  return typeof code === "string" && (APP_LANGUAGE_CODES as string[]).includes(code);
}

/** "en-GB" → "en"; "ro-MD"/"md" → "ro"; necunoscut → "en". */
export function normalizeLanguage(code: string | null | undefined): AppLanguage {
  if (!code) return "en";
  const short = String(code).toLowerCase().split(/[-_]/)[0];
  if (short === "md") return "ro";
  return isAppLanguage(short) ? short : "en";
}

export function languageMeta(code: AppLanguage): LanguageMeta {
  return APP_LANGUAGES.find((l) => l.code === code) ?? APP_LANGUAGES[1]!;
}

/** Limbile care NU sunt împachetate la pornire. */
export type LazyLanguage = Exclude<AppLanguage, "ro" | "en">;

/**
 * Import-uri dinamice, câte unul per limbă. Vite le transformă în chunk-uri
 * separate, descărcate abia când cineva chiar alege limba respectivă.
 */
const LAZY_DICTS: Record<LazyLanguage, () => Promise<{ default: PartialDict }>> = {
  de: () => import("./de"),
  fr: () => import("./fr"),
  es: () => import("./es"),
  it: () => import("./it"),
  pt: () => import("./pt"),
  nl: () => import("./nl"),
  pl: () => import("./pl"),
  hu: () => import("./hu"),
};

export function isLazyLanguage(code: AppLanguage): code is LazyLanguage {
  return code !== "ro" && code !== "en";
}

/**
 * Încarcă dicționarul unei limbi leneșe. Întoarce `null` dacă limba este deja
 * împachetată (ro/en) sau dacă încărcarea eșuează — apelantul continuă, iar
 * i18next cade cheie-cu-cheie pe engleză, exact ca pentru un dicționar parțial.
 */
export async function loadLanguageDict(code: AppLanguage): Promise<PartialDict | null> {
  if (!isLazyLanguage(code)) return null;
  try {
    const mod = await LAZY_DICTS[code]();
    return mod.default;
  } catch {
    return null;
  }
}

/**
 * Resursele disponibile din primul cadru. Celelalte limbi se adaugă la runtime
 * prin `i18n.addResourceBundle` (vezi `ensureLanguageLoaded` din lib/i18n.ts).
 */
export const RESOURCES: Record<"ro" | "en", { translation: unknown }> = {
  ro: { translation: ro },
  en: { translation: en },
};

export { ro, en };
