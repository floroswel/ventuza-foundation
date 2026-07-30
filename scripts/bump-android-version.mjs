#!/usr/bin/env node
/**
 * Bump versionCode/versionName pentru build-ul Android + generează
 * skeleton-ul de changelog pentru Fastlane supply.
 *
 * Usage:
 *   node scripts/bump-android-version.mjs patch|minor|major [--code=N]
 *   node scripts/bump-android-version.mjs set --name=1.2.3 --code=42
 *
 * Efect:
 *   - actualizează release/version.json
 *   - creează fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt
 *     (dacă lipsește) pentru fiecare locale existent, pre-populat din
 *     whatsnew.yml.default sau dintr-un placeholder.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const VERSION_FILE = resolve(ROOT, "release/version.json");
const METADATA_DIR = resolve(ROOT, "fastlane/metadata/android");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: bump-android-version.mjs patch|minor|major|set [--name=x.y.z] [--code=N]");
  process.exit(1);
}

const mode = args[0];
const flags = Object.fromEntries(
  args.slice(1).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const current = JSON.parse(readFileSync(VERSION_FILE, "utf8"));
let [maj, min, pat] = current.versionName.split(".").map((n) => parseInt(n, 10));
let nextName = current.versionName;
let nextCode = current.versionCode + 1;

switch (mode) {
  case "patch": pat += 1; nextName = `${maj}.${min}.${pat}`; break;
  case "minor": min += 1; pat = 0; nextName = `${maj}.${min}.${pat}`; break;
  case "major": maj += 1; min = 0; pat = 0; nextName = `${maj}.${min}.${pat}`; break;
  case "set":
    if (flags.name) nextName = String(flags.name);
    if (flags.code) nextCode = parseInt(String(flags.code), 10);
    break;
  default:
    console.error(`Mod necunoscut: ${mode}`);
    process.exit(1);
}
if (flags.code && mode !== "set") nextCode = parseInt(String(flags.code), 10);

if (!/^\d+\.\d+\.\d+$/.test(nextName)) {
  console.error(`versionName invalid: ${nextName}`);
  process.exit(1);
}
if (!Number.isInteger(nextCode) || nextCode <= current.versionCode) {
  console.error(`versionCode trebuie să crească strict (curent ${current.versionCode}, propus ${nextCode})`);
  process.exit(1);
}

const next = { ...current, versionName: nextName, versionCode: nextCode };
writeFileSync(VERSION_FILE, JSON.stringify(next, null, 2) + "\n");
console.log(`✓ release/version.json → ${nextName} (code ${nextCode})`);

// Menține APP_VERSION (folosit de VersionGate) sincron cu versionName-ul de release.
const APP_VERSION_FILE = resolve(ROOT, "src/lib/app-version.ts");
if (existsSync(APP_VERSION_FILE)) {
  const src = readFileSync(APP_VERSION_FILE, "utf8");
  const patched = src.replace(
    /export const APP_VERSION = "[^"]*";/,
    `export const APP_VERSION = "${nextName}";`,
  );
  if (patched !== src) {
    writeFileSync(APP_VERSION_FILE, patched);
    console.log(`✓ src/lib/app-version.ts → APP_VERSION="${nextName}"`);
  }
}

// Pre-generare changelog pentru fiecare locale (max 500 chars conform Play Store).
const locales = readdirSync(METADATA_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const placeholders = {
  "en-US": `Suzeta ${nextName}\n\n- Improvements and bug fixes.\n\nCompletează înainte de upload pe Play Console.`,
  "ro-RO": `Suzeta ${nextName}\n\n- Îmbunătățiri și corectări de bug-uri.\n\nCompletează înainte de upload pe Play Console.`,
};

for (const locale of locales) {
  const dir = resolve(METADATA_DIR, locale, "changelogs");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${nextCode}.txt`);
  if (existsSync(file)) {
    console.log(`= ${locale}/changelogs/${nextCode}.txt (există, neatins)`);
    continue;
  }
  const body = (placeholders[locale] ?? placeholders["en-US"]).slice(0, 500);
  writeFileSync(file, body + "\n");
  console.log(`+ ${locale}/changelogs/${nextCode}.txt`);
}

console.log("\nUrmătorii pași:");
console.log("  1. Editează fastlane/metadata/android/<locale>/changelogs/" + nextCode + ".txt");
console.log("  2. bun run build:mobile && npx cap sync android");
console.log("  3. cd android && ./gradlew bundleRelease");
console.log("  4. bundle exec fastlane internal   # sau upload manual .aab în Play Console");
