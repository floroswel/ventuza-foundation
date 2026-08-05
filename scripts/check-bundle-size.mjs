#!/usr/bin/env node
/**
 * Bundle size budget check.
 * Fails CI if any chunk or the total initial JS exceeds its budget.
 *
 * Usage: node scripts/check-bundle-size.mjs [--json]
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Directorul de assets diferă între build-uri, deci îl detectăm:
 *
 *  - `bun run build:mobile` (vite.mobile.config.ts) are `nitro: false` și
 *    `outDir` explicit → `dist/client/assets`.
 *  - `bun run build` (vite.config.ts) rulează cu nitro. Override-ul
 *    `output.publicDir = "dist/client"` din @lovable.dev/vite-tanstack-config se
 *    aplică DOAR în sandbox-ul Lovable; pe runnerul CI nitro folosește
 *    output-ul implicit → `.output/public/assets`.
 *
 * Prima cale existentă câștigă. Se poate forța cu BUNDLE_ASSETS_DIR.
 */
const CANDIDATES = [
  process.env.BUNDLE_ASSETS_DIR,
  "dist/client/assets",
  ".output/public/assets",
].filter(Boolean);

function resolveAssetsDir() {
  for (const dir of CANDIDATES) {
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
  }
  console.error("\n❌ Bundle size check FAILED: nu găsesc directorul de assets.\n");
  console.error("Căi verificate, în ordine:");
  for (const dir of CANDIDATES) console.error(`  - ${dir}`);
  console.error(
    "\nRulează întâi un build (`bun run build` sau `bun run build:mobile`).\n" +
      "Dacă build-ul scrie în altă parte, setează BUNDLE_ASSETS_DIR=<cale>.\n",
  );
  process.exit(1);
}

const DIST = resolveAssetsDir();

// Budgets in KB (gzipped). Raise deliberately when a change is justified.
// Pattern matches the filename prefix (before the hash).
const BUDGETS = [
  // Main entry (React + tanstack router + core UI). Watch closely.
  { pattern: /^index-[^.]+\.js$/, maxGzipKB: 175, label: "main entry" },

  // Route chunks — user-facing hot paths.
  { pattern: /^discover-[^.]+\.js$/, maxGzipKB: 30, label: "/discover" },
  { pattern: /^nearby-[^.]+\.js$/, maxGzipKB: 15, label: "/nearby (list)" },
  { pattern: /^partner-[^.]+\.js$/, maxGzipKB: 12, label: "/partner" },
  { pattern: /^messages\.index-[^.]+\.js$/, maxGzipKB: 20, label: "/messages (list)" },
  { pattern: /^messages\._id-[^.]+\.js$/, maxGzipKB: 40, label: "/messages/$id (thread)" },
  { pattern: /^profile-[^.]+\.js$/, maxGzipKB: 20, label: "/profile" },

  // Lazy-loaded heavy libs — must stay lazy (not merged into main).
  { pattern: /^maplibre-gl-[^.]+\.js$/, maxGzipKB: 285, label: "maplibre-gl (lazy)" },
  { pattern: /^heic2any-[^.]+\.js$/, maxGzipKB: 360, label: "heic2any (lazy)" },
];

// Total initial JS budget (main entry + eagerly loaded chunks).
// Route chunks loaded via <Link preload> don't count as initial.
const TOTAL_INITIAL_GZIP_KB = 260;

function listJs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((name) => {
      const path = join(dir, name);
      const buf = readFileSync(path);
      return {
        name,
        raw: statSync(path).size,
        gzip: gzipSync(buf).length,
      };
    });
}

const files = listJs(DIST);
const failures = [];
const warnings = [];
const report = [];

for (const budget of BUDGETS) {
  const match = files.find((f) => budget.pattern.test(f.name));
  if (!match) {
    warnings.push(`missing chunk for budget: ${budget.label} (${budget.pattern})`);
    continue;
  }
  const gzKB = match.gzip / 1024;
  const pct = (gzKB / budget.maxGzipKB) * 100;
  const line = `  ${match.name.padEnd(50)} ${gzKB.toFixed(1).padStart(7)} KB gz / ${budget.maxGzipKB} KB (${pct.toFixed(0)}%) — ${budget.label}`;
  report.push(line);
  if (gzKB > budget.maxGzipKB) {
    failures.push(`OVER BUDGET: ${budget.label} (${match.name}) — ${gzKB.toFixed(1)} KB gz > ${budget.maxGzipKB} KB`);
  }
}

// Total initial = main entry only (route chunks are lazy via TanStack Router
// autoCodeSplitting; they preload on intent but are not blocking for FCP).
const initial = files.find((f) => /^index-[^.]+\.js$/.test(f.name));
const initialKB = initial ? initial.gzip / 1024 : 0;

console.log(`\n=== Bundle size budgets (assets: ${DIST}) ===\n`);
console.log(report.join("\n"));
console.log(`\nInitial JS (main entry gzip): ${initialKB.toFixed(1)} KB / ${TOTAL_INITIAL_GZIP_KB} KB budget`);

if (initialKB > TOTAL_INITIAL_GZIP_KB) {
  failures.push(`OVER TOTAL BUDGET: initial JS ${initialKB.toFixed(1)} KB > ${TOTAL_INITIAL_GZIP_KB} KB`);
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (failures.length) {
  console.error("\n❌ Bundle size check FAILED:\n");
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nIf the increase is justified, raise the budget in scripts/check-bundle-size.mjs and note why in the commit.\n");
  process.exit(1);
}

console.log("\n✅ All budgets OK.\n");
