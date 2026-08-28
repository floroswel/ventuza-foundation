#!/usr/bin/env node
/**
 * Gardian pentru fișierul `.env` versionat.
 *
 * DE CE EXISTĂ: `.env` este comis intenționat în acest repository (îl consumă
 * Lovable la build, iar `resolve-public-env.mjs` îl folosește ca ultimă sursă
 * în CI). Decizia e sigură cât timp fișierul conține EXCLUSIV valori publice
 * prin design — cheia anon, site key-ul Turnstile, client ID-ul OAuth — toate
 * prezente oricum în orice APK sau în orice bundle servit din browser.
 *
 * Riscul nu e starea de azi, ci ziua în care cineva adaugă acolo un
 * `SUPABASE_SERVICE_ROLE_KEY` sau o cheie de serviciu Firebase. Repository-ul
 * fiind public, secretul ar deveni public în aceeași secundă, fără ca nimeni
 * să observe. Scriptul transformă acel accident tăcut într-un build roșu.
 *
 * Trei straturi de verificare:
 *   1. ALLOWLIST de chei — orice nume necunoscut oprește build-ul.
 *   2. TIPARE de secret — chiar și sub un nume permis, refuzăm valori care
 *      arată a cheie privată, JWT privilegiat sau token de serviciu.
 *   3. ROLUL din JWT — un JWT Supabase e decodat, iar orice rol diferit de
 *      `anon` este respins. `service_role` nu conține niciodată textul în
 *      clar, deci verificarea pe nume de variabilă nu ar fi prins-o.
 *
 * Utilizare: node scripts/check-env-safety.mjs [cale]   (implicit `.env`)
 * Iese cu 1 și explică exact ce a găsit și ce trebuie făcut.
 */
import { readFileSync, existsSync } from "node:fs";

/** Chei permise în `.env`. Toate sunt publice prin design. */
const ALLOWED_KEYS = new Set([
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_TURNSTILE_SITE_KEY",
  "VITE_GOOGLE_WEB_CLIENT_ID",
  "VITE_BUILD_SHA",
  "VITE_BUILD_VERSION_CODE",
  "VITE_ANDROID_APP_SIGNING_SHA1",
  "VITE_ANDROID_APP_SIGNING_SHA256",
  "VITE_ANDROID_UPLOAD_SHA1",
  "VITE_ANDROID_UPLOAD_SHA256",
  "VITE_ANDROID_IAS_SHA1",
]);

/** Tipare care nu au ce căuta într-un fișier versionat, sub niciun nume. */
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "cheie privată PEM"],
  [/\bsk_live_[A-Za-z0-9]{10,}/, "cheie secretă Stripe (live)"],
  [/\bsk_test_[A-Za-z0-9]{10,}/, "cheie secretă Stripe (test)"],
  [/\bghp_[A-Za-z0-9]{20,}/, "token personal GitHub"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "token personal GitHub"],
  [/\bAIza[A-Za-z0-9_\-]{30,}/, "cheie API Google"],
  [/"type"\s*:\s*"service_account"/, "JSON de service account"],
];

/** Nume care semnalează un secret chiar dacă valoarea pare inofensivă. */
const FORBIDDEN_NAME = /(SERVICE_ROLE|SERVICE_ACCOUNT|PRIVATE_KEY|_SECRET|SECRET_|PASSWORD|_TOKEN\b|WEBHOOK_SECRET)/i;

/**
 * Decodează payload-ul unui JWT fără să valideze semnătura — ne interesează
 * doar rolul declarat. Un `service_role` apare aici, dar niciodată în clar în
 * textul fișierului, pentru că payload-ul e base64.
 */
function jwtRole(value) {
  const m = /^(eyJ[A-Za-z0-9_-]+)\.(eyJ[A-Za-z0-9_-]+)\./.exec(value.trim());
  if (!m) return null;
  try {
    const json = Buffer.from(m[2].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const role = JSON.parse(json).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

const file = process.argv[2] ?? ".env";
if (!existsSync(file)) {
  console.log(`✓ ${file} nu există — nimic de verificat.`);
  process.exit(0);
}

const raw = readFileSync(file, "utf8");
const problems = [];

for (const [pattern, label] of SECRET_PATTERNS) {
  if (pattern.test(raw)) problems.push(`conține ${label}`);
}

raw.split(/\r?\n/).forEach((line, i) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
  if (!m) return;
  const [, key, rawValue] = m;
  const value = rawValue.replace(/^["']|["']$/g, "");
  const at = `linia ${i + 1}`;

  if (!ALLOWED_KEYS.has(key)) {
    problems.push(`${at}: cheia \`${key}\` nu este în allowlist`);
  }
  if (FORBIDDEN_NAME.test(key)) {
    problems.push(`${at}: numele \`${key}\` indică un secret`);
  }
  const role = jwtRole(value);
  if (role && role !== "anon") {
    problems.push(`${at}: \`${key}\` conține un JWT cu rolul \`${role}\` (doar \`anon\` este permis)`);
  }
});

if (problems.length) {
  console.error(`\n✗ ${file} nu poate fi versionat în starea actuală.\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error(
    "\nRepository-ul este public: orice valoare din acest fișier devine publică.\n" +
      "Mută secretul într-un GitHub Secret sau într-un secret Lovable Cloud și\n" +
      "citește-l din `process.env` pe server. Dacă adaugi o cheie nouă care este\n" +
      "cu adevărat publică, treci-o explicit în ALLOWED_KEYS din acest script.\n",
  );
  process.exit(1);
}

console.log(`✓ ${file} conține doar valori publice prin design.`);
