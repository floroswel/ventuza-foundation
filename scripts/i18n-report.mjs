#!/usr/bin/env bun
/**
 * Raport automat de traduceri.
 *
 *   bun scripts/i18n-report.mjs            → raport în consolă
 *   bun scripts/i18n-report.mjs --md out.md → scrie și un markdown
 *   bun scripts/i18n-report.mjs --json out.json
 *
 * Arată, pentru fiecare limbă: cheile lipsă, cheile căzute pe engleză
 * (prezente, dar cu text identic cu EN) și cheile orfane. Include și
 * acoperirea etichetelor de opțiuni din onboarding (gen, pronume, orientare,
 * „ce caut", interese, triburi).
 */
import { writeFileSync } from "node:fs";

import { RESOURCES, APP_LANGUAGES } from "../src/locales/index.ts";
import { computeCoverage, coverageMarkdown } from "../src/lib/i18n/dictionary-io.ts";
import { optionLabelCoverage } from "../src/lib/i18n/option-labels.ts";

const dictionaries = Object.fromEntries(
  Object.entries(RESOURCES).map(([code, r]) => [code, r.translation]),
);

const rows = computeCoverage(dictionaries.en, dictionaries, { referenceLanguage: "en" });
const options = optionLabelCoverage(APP_LANGUAGES.map((l) => l.code));

let md = coverageMarkdown(rows, "Acoperire traduceri — ecrane (i18next)");
md += "\n# Acoperire etichete opțiuni (onboarding & profil)\n\n| Limbă | Acoperire | Lipsă |\n| --- | --- | --- |\n";
for (const o of options) {
  md += `| ${o.locale} | ${o.percent}% (${o.translated}/${o.total}) | ${o.missing.length} |\n`;
}
for (const o of options) {
  if (!o.missing.length) continue;
  md += `\n## opțiuni · ${o.locale}\n\n` + o.missing.map((k) => `- \`${k}\``).join("\n") + "\n";
}

console.log("Ecrane (chei i18next):");
for (const r of rows) {
  console.log(
    `  ${r.language.padEnd(3)} ${String(r.percent).padStart(5)}%  lipsă ${String(r.missing.length).padStart(4)}  ==EN ${String(r.sameAsEnglish.length).padStart(4)}  orfane ${r.orphan.length}`,
  );
}
console.log("\nEtichete opțiuni:");
for (const o of options) {
  console.log(`  ${o.locale.padEnd(3)} ${String(o.percent).padStart(5)}%  lipsă ${o.missing.length}`);
}

const args = process.argv.slice(2);
const mdIdx = args.indexOf("--md");
if (mdIdx !== -1 && args[mdIdx + 1]) {
  writeFileSync(args[mdIdx + 1], md);
  console.log(`\n✓ markdown → ${args[mdIdx + 1]}`);
}
const jsonIdx = args.indexOf("--json");
if (jsonIdx !== -1 && args[jsonIdx + 1]) {
  writeFileSync(
    args[jsonIdx + 1],
    JSON.stringify({ generatedAt: new Date().toISOString(), screens: rows, options }, null, 2),
  );
  console.log(`✓ json → ${args[jsonIdx + 1]}`);
}
