#!/usr/bin/env node
/**
 * Rezolvă configurația PUBLICĂ Supabase pentru CI, o singură dată, în loc de
 * logică duplicată în trei workflow-uri.
 *
 * Ordinea de prioritate pentru fiecare cheie:
 *   1. GitHub Secret  → ajunge aici prin `process.env` (setat de pasul din workflow)
 *   2. GitHub Variable → idem, prin `secrets.X || vars.X` în workflow
 *   3. fișierul `.env` versionat în repository
 *
 * Doar aceste trei valori sunt permise, toate publice prin design:
 *   - VITE_SUPABASE_URL            (URL-ul proiectului)
 *   - VITE_SUPABASE_PUBLISHABLE_KEY (cheia anon/publishable, protejată de RLS)
 *   - VITE_SUPABASE_PROJECT_ID     (ref-ul public al proiectului)
 *
 * Garanții de siguranță:
 *   - `.env` NU este niciodată executat (fără `source`, fără eval); e parsat
 *     linie cu linie cu o expresie regulată.
 *   - Se extrag EXCLUSIV cheile din allowlist; orice altă linie e ignorată,
 *     deci un `SUPABASE_SERVICE_ROLE_KEY` sau alt secret nu poate ieși de aici.
 *   - Valorile nu sunt scrise niciodată în log — doar prezența și lungimea.
 *   - Cheia publishable e trecută prin `::add-mask::`, ca o eventuală scurgere
 *     accidentală în logurile pașilor următori să apară redactată.
 *
 * Utilizare:
 *   node scripts/resolve-public-env.mjs             # scrie în $GITHUB_ENV
 *   node scripts/resolve-public-env.mjs --out FILE  # scrie KEY=VALUE în FILE
 *
 * (Flagul se numește `--out`, nu `--env-file`: acesta din urmă este un flag
 * nativ al Node 20+, care ar fi interceptat argumentul înainte de script.)
 *
 * Iese cu cod 1 și mesaj clar doar dacă o valoare lipsește din TOATE sursele.
 */
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";

const ALLOWED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID"];
const ENV_FILE = ".env";

const isCI = Boolean(process.env.GITHUB_ENV);
const argOutIndex = process.argv.indexOf("--out");
const envFileOut = argOutIndex !== -1 ? process.argv[argOutIndex + 1] : null;

/** Parsează `.env` fără a-l executa. Reține doar cheile din allowlist. */
function readAllowedFromEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (!ALLOWED.includes(key)) continue; // allowlist strict
    let value = rawValue.trim();
    // Scoate ghilimelele care înconjoară valoarea (simple sau duble).
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (value) out[key] = value;
  }
  return out;
}

/** Derivă ref-ul de proiect din hostname: https://<ref>.supabase.co → <ref>. */
function deriveProjectId(url) {
  try {
    const host = new URL(url).hostname;
    const label = host.split(".")[0];
    return /^[a-z0-9-]{8,64}$/i.test(label) ? label : null;
  } catch {
    return null;
  }
}

const VALIDATORS = {
  VITE_SUPABASE_URL: (v) => {
    let u;
    try {
      u = new URL(v);
    } catch {
      return "nu este un URL valid";
    }
    if (u.protocol !== "https:") return "trebuie să folosească https://";
    return null;
  },
  VITE_SUPABASE_PUBLISHABLE_KEY: (v) =>
    /^[A-Za-z0-9._-]{20,}$/.test(v)
      ? null
      : "format neașteptat (aștept un token fără spații, minim 20 caractere)",
  VITE_SUPABASE_PROJECT_ID: (v) =>
    /^[a-z0-9-]{8,64}$/i.test(v) ? null : "format neașteptat (aștept ref-ul public al proiectului)",
};

const fromFile = readAllowedFromEnvFile(ENV_FILE);
const resolved = {};
const sources = {};

for (const key of ALLOWED) {
  const fromEnv = (process.env[key] ?? "").trim();
  if (fromEnv) {
    resolved[key] = fromEnv;
    sources[key] = "secret/variable";
  } else if (fromFile[key]) {
    resolved[key] = fromFile[key];
    sources[key] = `${ENV_FILE} (versionat)`;
  }
}

// PROJECT_ID e derivabil din URL dacă lipsește explicit.
if (!resolved.VITE_SUPABASE_PROJECT_ID && resolved.VITE_SUPABASE_URL) {
  const derived = deriveProjectId(resolved.VITE_SUPABASE_URL);
  if (derived) {
    resolved.VITE_SUPABASE_PROJECT_ID = derived;
    sources.VITE_SUPABASE_PROJECT_ID = "derivat din VITE_SUPABASE_URL";
  }
}

const errors = [];
for (const key of ALLOWED) {
  const value = resolved[key];
  if (!value) {
    errors.push(
      `${key} lipsește din toate sursele (GitHub Secret, GitHub Variable, ${ENV_FILE} versionat).`,
    );
    continue;
  }
  const problem = VALIDATORS[key](value);
  if (problem) errors.push(`${key}: ${problem}.`);
}

const log = (line) => process.stdout.write(`${line}\n`);

if (errors.length) {
  for (const e of errors) log(`::error::${e}`);
  log(
    "::error::Adaugă valorile fie ca GitHub Secrets/Variables (Settings → Secrets and variables → Actions), fie păstrează-le în `.env`-ul versionat. Sunt valori publice: URL de proiect, cheie anon protejată de RLS, ref public.",
  );
  process.exit(1);
}

// Mască defensivă pentru cheie, ca o scurgere accidentală ulterioară să apară redactată.
if (isCI) log(`::add-mask::${resolved.VITE_SUPABASE_PUBLISHABLE_KEY}`);

log("Configurație publică Supabase rezolvată (valorile nu sunt afișate):");
for (const key of ALLOWED) {
  log(`  ${key}: prezent, ${resolved[key].length} caractere — sursă: ${sources[key]}`);
}

const lines = ALLOWED.map((k) => `${k}=${resolved[k]}`).join("\n");

if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `${lines}\n`, "utf8");
  log("Scrise în $GITHUB_ENV pentru pașii următori.");
}
if (envFileOut) {
  writeFileSync(envFileOut, `${lines}\n`, "utf8");
  log(`Scrise în ${envFileOut}.`);
}
if (!process.env.GITHUB_ENV && !envFileOut) {
  log("(rulare locală: fără $GITHUB_ENV și fără --out, nu s-a scris nimic)");
}
