/**
 * `navigator.language` poate întoarce etichete care nu sunt BCP-47 valide
 * (ex. `en-US@posix` pe unele WebView-uri / emulatoare Android). Trecute
 * direct în `toLocaleTimeString`, aruncă `RangeError: Invalid language tag`
 * și pică tot ecranul. Aici normalizăm și validăm o singură dată.
 */
const FALLBACK = "ro-RO";

let cached: string | null = null;

export function safeLocale(): string {
  if (cached) return cached;
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
