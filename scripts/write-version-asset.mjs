#!/usr/bin/env node
/**
 * Scrie `public/app-version.json` din `release/version.json`.
 *
 * Fișierul este servit de web (suzeta.app/app-version.json) și este sursa pe
 * care aplicația nativă o interoghează ca să știe dacă în Play există o
 * versiune mai nouă decât cea instalată (vezi src/lib/app-update.ts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const v = JSON.parse(readFileSync(resolve(ROOT, "release/version.json"), "utf8"));

const payload = {
  versionName: v.versionName,
  versionCode: v.versionCode,
  notes: v.notes ?? "",
  updatedAt: new Date().toISOString(),
};

writeFileSync(resolve(ROOT, "public/app-version.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(`✓ public/app-version.json → ${payload.versionName} (code ${payload.versionCode})`);
