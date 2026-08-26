/**
 * Detecție de limbă din preferințele browserului.
 *
 * Sursa preferată este header-ul HTTP `Accept-Language` (SSR — știm limba
 * ÎNAINTE de primul paint, deci `<html lang>` e corect și nu apare flash de
 * limbă greșită). Pe client folosim `navigator.languages`, care este exact
 * lista din care browserul construiește acel header.
 *
 * Fallback: limba de bază a variantei regionale („de-AT” → „de”), apoi
 * engleza. Alegerea manuală a utilizatorului (localStorage `vz-lang`) are
 * întotdeauna prioritate — funcțiile de aici nu o suprascriu.
 */

export type ParsedLanguage = { code: string; quality: number };

/** „ro-RO,ro;q=0.9,en-US;q=0.8” → listă sortată descrescător după q. */
export function parseAcceptLanguage(header: string | null | undefined): ParsedLanguage[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      if (!tag) return null;
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return {
        code: tag.trim().toLowerCase(),
        quality: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((x): x is ParsedLanguage & { index: number } => !!x && x.code !== "" && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ code, quality }) => ({ code, quality }));
}

/** Aliasuri pentru locale care nu au dicționar propriu, dar sunt inteligibile. */
const ALIASES: Record<string, string> = { md: "ro", "ro-md": "ro", "pt-br": "pt", "pt-pt": "pt" };

/**
 * Alege prima limbă suportată din lista de preferințe (tag exact, apoi limba
 * de bază). Întoarce `fallback` dacă nimic nu se potrivește.
 */
export function pickSupportedLanguage(
  preferences: readonly (ParsedLanguage | string)[],
  supported: readonly string[],
  fallback = "en",
): string {
  const set = new Set(supported.map((s) => s.toLowerCase()));
  for (const pref of preferences) {
    const raw = (typeof pref === "string" ? pref : pref.code).toLowerCase();
    if (raw === "*") continue;
    const alias = ALIASES[raw];
    if (alias && set.has(alias)) return alias;
    if (set.has(raw)) return raw;
    const base = raw.split(/[-_]/)[0]!;
    if (ALIASES[base] && set.has(ALIASES[base]!)) return ALIASES[base]!;
    if (set.has(base)) return base;
  }
  return fallback;
}

/** Varianta client: `navigator.languages` are aceeași semantică cu header-ul. */
export function pickFromNavigator(supported: readonly string[], fallback = "en"): string {
  if (typeof navigator === "undefined") return fallback;
  const nav = navigator as Navigator & { userLanguage?: string };
  const list = [
    ...(nav.languages ?? []),
    nav.language,
    nav.userLanguage,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return pickSupportedLanguage(list, supported, fallback);
}

export function pickFromAcceptLanguage(
  header: string | null | undefined,
  supported: readonly string[],
  fallback = "en",
): string {
  return pickSupportedLanguage(parseAcceptLanguage(header), supported, fallback);
}
