/**
 * Utilitare pure pentru dicționarele de traducere.
 *
 * Folosite de:
 *   - `scripts/i18n-report.mjs` (raport CLI cu chei lipsă / căzute pe engleză)
 *   - panoul admin „Traduceri" (export/import fără modificări de cod)
 *   - `src/lib/i18n/overrides.ts` (aplicare la runtime)
 *
 * Nu importă i18next și nu atinge DOM-ul — poate rula și în Node.
 */

export type NestedDict = { [key: string]: string | NestedDict };
export type FlatDict = Record<string, string>;

/** { a: { b: "x" } } → { "a.b": "x" } */
export function flatten(obj: unknown, prefix = ""): FlatDict {
  const out: FlatDict = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

/** { "a.b": "x" } → { a: { b: "x" } } */
export function unflatten(flat: FlatDict): NestedDict {
  const out: NestedDict = {};
  for (const [key, value] of Object.entries(flat)) {
    if (typeof value !== "string") continue;
    const parts = key.split(".");
    let node: NestedDict = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      const next = node[p];
      if (!next || typeof next === "string") node[p] = {};
      node = node[p] as NestedDict;
    }
    node[parts[parts.length - 1]!] = value;
  }
  return out;
}

/** Merge adânc, `patch` câștigă. Nu mutează argumentele. */
export function deepMerge<T extends NestedDict>(base: T, patch: NestedDict): T {
  const out: NestedDict = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    if (v && typeof v === "object" && cur && typeof cur === "object") {
      out[k] = deepMerge(cur as NestedDict, v as NestedDict);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export type LanguageCoverage = {
  language: string;
  total: number;
  translated: number;
  /** Chei complet absente din dicționarul limbii. */
  missing: string[];
  /** Chei prezente, dar identice cu engleza (probabil netraduse). */
  sameAsEnglish: string[];
  /** Chei prezente în limbă, dar inexistente în referință (englezș) — de curățat. */
  orphan: string[];
  percent: number;
};

/**
 * Compară fiecare limbă cu referința (engleza) și raportează exact ce
 * lipsește. `sameAsEnglish` prinde cazul „a căzut pe engleză" chiar dacă
 * cheia există în fișier.
 */
export function computeCoverage(
  reference: NestedDict,
  dictionaries: Record<string, NestedDict>,
  options: { referenceLanguage?: string; ignoreIdentical?: readonly string[] } = {},
): LanguageCoverage[] {
  const ref = flatten(reference);
  const refKeys = Object.keys(ref).sort();
  const ignore = new Set(options.ignoreIdentical ?? []);
  const out: LanguageCoverage[] = [];

  for (const [language, dict] of Object.entries(dictionaries)) {
    if (language === (options.referenceLanguage ?? "en")) continue;
    const flat = flatten(dict);
    const missing: string[] = [];
    const sameAsEnglish: string[] = [];
    for (const key of refKeys) {
      const value = flat[key];
      if (value === undefined || value === "") {
        missing.push(key);
      } else if (value === ref[key] && !ignore.has(key)) {
        sameAsEnglish.push(key);
      }
    }
    const orphan = Object.keys(flat)
      .filter((k) => !(k in ref))
      .sort();
    const translated = refKeys.length - missing.length - sameAsEnglish.length;
    out.push({
      language,
      total: refKeys.length,
      translated,
      missing,
      sameAsEnglish,
      orphan,
      percent: refKeys.length ? Math.round((translated / refKeys.length) * 1000) / 10 : 100,
    });
  }
  return out.sort((a, b) => b.percent - a.percent);
}

/** Raport markdown, gata de pus într-un fișier sau într-un panou admin. */
export function coverageMarkdown(rows: LanguageCoverage[], title = "Acoperire traduceri"): string {
  const lines: string[] = [`# ${title}`, "", "| Limbă | Acoperire | Lipsă | Identice cu EN | Orfane |", "| --- | --- | --- | --- | --- |"];
  for (const r of rows) {
    lines.push(
      `| ${r.language} | ${r.percent}% (${r.translated}/${r.total}) | ${r.missing.length} | ${r.sameAsEnglish.length} | ${r.orphan.length} |`,
    );
  }
  for (const r of rows) {
    if (!r.missing.length && !r.sameAsEnglish.length && !r.orphan.length) continue;
    lines.push("", `## ${r.language}`);
    if (r.missing.length) lines.push("", "**Chei lipsă**", "", ...r.missing.map((k) => `- \`${k}\``));
    if (r.sameAsEnglish.length)
      lines.push("", "**Căzute pe engleză**", "", ...r.sameAsEnglish.map((k) => `- \`${k}\``));
    if (r.orphan.length) lines.push("", "**Chei orfane**", "", ...r.orphan.map((k) => `- \`${k}\``));
  }
  return lines.join("\n") + "\n";
}

export type DictionaryBundle = {
  /** Versiune de format, ca importurile vechi să poată fi migrate. */
  format: 1;
  generatedAt: string;
  /** cod limbă → dicționar plat („a.b": "text"), ușor de editat manual. */
  languages: Record<string, FlatDict>;
};

export function buildBundle(dictionaries: Record<string, NestedDict>): DictionaryBundle {
  return {
    format: 1,
    generatedAt: new Date().toISOString(),
    languages: Object.fromEntries(
      Object.entries(dictionaries).map(([code, dict]) => [code, flatten(dict)]),
    ),
  };
}

/** Validează un fișier importat; aruncă mesaj clar dacă structura e greșită. */
export function parseBundle(raw: unknown, allowedLanguages: readonly string[]): DictionaryBundle {
  const b = raw as Partial<DictionaryBundle> | null;
  if (!b || typeof b !== "object" || !b.languages || typeof b.languages !== "object") {
    throw new Error("Fișier invalid: lipsește obiectul „languages”.");
  }
  const languages: Record<string, FlatDict> = {};
  for (const [code, dict] of Object.entries(b.languages)) {
    if (!allowedLanguages.includes(code)) {
      throw new Error(`Limbă necunoscută în fișier: „${code}”.`);
    }
    if (!dict || typeof dict !== "object") {
      throw new Error(`Dicționar invalid pentru „${code}”.`);
    }
    const flat: FlatDict = {};
    for (const [k, v] of Object.entries(dict as Record<string, unknown>)) {
      if (typeof v !== "string") throw new Error(`Valoare non-text la „${code}.${k}”.`);
      flat[k] = v;
    }
    languages[code] = flat;
  }
  return { format: 1, generatedAt: b.generatedAt ?? new Date().toISOString(), languages };
}

/**
 * Reține doar cheile care diferă de dicționarul livrat în build — overrides-ul
 * salvat în DB rămâne mic și nu îngheață traducerile viitoare din cod.
 */
export function bundleToOverrides(
  bundle: DictionaryBundle,
  shipped: Record<string, NestedDict>,
): Record<string, FlatDict> {
  const out: Record<string, FlatDict> = {};
  for (const [code, flat] of Object.entries(bundle.languages)) {
    const base = flatten(shipped[code] ?? {});
    const diff: FlatDict = {};
    for (const [k, v] of Object.entries(flat)) {
      if (base[k] !== v) diff[k] = v;
    }
    if (Object.keys(diff).length) out[code] = diff;
  }
  return out;
}
