/**
 * `navigator.language` poate întoarce etichete care nu sunt BCP-47 valide
 * (ex. `en-US@posix` pe unele WebView-uri / emulatoare Android). Trecute
 * direct în `toLocaleTimeString`, aruncă `RangeError: Invalid language tag`
 * și pică tot ecranul. Aici normalizăm și validăm o singură dată.
 */
const FALLBACK = "ro-RO";

/** Limba aleasă în aplicație are prioritate față de limba sistemului. */
const APP_LANG_TO_LOCALE: Record<string, string> = {
  ro: "ro-RO",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  nl: "nl-NL",
  pl: "pl-PL",
  pt: "pt-PT",
  hu: "hu-HU",
};

let cached: string | null = null;
let cachedFor: string | null = null;

function appLanguage(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem("vz-lang");
    if (stored) return stored.split("-")[0]!.toLowerCase();
  } catch {
    /* storage blocat */
  }
  const docLang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return (docLang || "").split("-")[0]!.toLowerCase();
}

export function safeLocale(): string {
  const app = appLanguage();
  if (cached && cachedFor === app) return cached;
  cachedFor = app;
  const fromApp = app ? APP_LANG_TO_LOCALE[app] : undefined;
  if (fromApp) {
    cached = fromApp;
    return cached;
  }
  const raw = typeof navigator !== "undefined" ? navigator.language : "";
  // Taie extensiile POSIX/variantele nesuportate: `en-US@posix` -> `en-US`.
  const cleaned = (raw || "").split("@")[0]?.trim() ?? "";
  cached = isValidLocale(cleaned) ? cleaned : FALLBACK;
  return cached;
}


function isValidLocale(tag: string): boolean {
  if (!tag) return false;
  try {
    new Intl.DateTimeFormat(tag);
    return true;
  } catch {
    return false;
  }
}

/** Formatare robustă: nu aruncă niciodată, cade pe fallback la eroare. */
export function safeFormat(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  kind: "time" | "date" | "datetime" = "datetime",
): string {
  const fmt = (loc: string) =>
    kind === "time"
      ? date.toLocaleTimeString(loc, options)
      : kind === "date"
        ? date.toLocaleDateString(loc, options)
        : date.toLocaleString(loc, options);
  try {
    return fmt(safeLocale());
  } catch {
    try {
      return fmt(FALLBACK);
    } catch {
      return date.toISOString();
    }
  }
}
