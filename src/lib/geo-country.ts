/**
 * Single source of truth for "which country is this device in".
 *
 * Primary: our own /api/public/geo-country (CDN header, no third party, no rate limit).
 * Fallback: cached hint in localStorage.
 *
 * Fail-graceful by design: when we cannot tell, we return null and callers must
 * NOT block the user (see src/lib/country-gate.ts).
 */
const HINT_KEY = "cc_hint";
let inflight: Promise<string | null> | null = null;

function readHint(): string | null {
  try {
    const v = localStorage.getItem(HINT_KEY);
    return v && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeHint(cc: string) {
  try {
    localStorage.setItem(HINT_KEY, cc);
  } catch {
    /* ignore */
  }
}

export async function detectCountryCode(): Promise<string | null> {
  const hint = readHint();
  if (hint) return hint;
  inflight ??= (async () => {
    try {
      const { apiUrl } = await import("@/lib/native-api-origin");
      const res = await fetch(apiUrl("/api/public/geo-country"), { cache: "force-cache" });
      if (!res.ok) return null;
      const json = (await res.json()) as { country?: string | null };
      const cc = String(json?.country ?? "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return null;
      writeHint(cc);
      return cc;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
