#!/usr/bin/env node
/**
 * Verifică ÎNAINTE de upload că `versionCode`-ul pe care urmează să-l urcăm nu
 * este deja folosit în Google Play. Erorile Play Console
 *   "This release does not add or remove any app bundles"
 *   "doesn't allow any existing users to upgrade"
 * apar exact când urcăm un bundle cu un versionCode deja existent (sau când nu
 * se atașează niciun bundle nou). Acest gard oprește pipeline-ul înainte.
 *
 * Usage:
 *   PLAY_SERVICE_ACCOUNT_JSON='{...}' node scripts/check-play-version-code.mjs \
 *     --package app.suzeta --code 30
 *
 * Fără PLAY_SERVICE_ACCOUNT_JSON scriptul iese cu 0 și doar avertizează
 * (build-uri locale / artefact-only nu au acces la Play API).
 */
import { createSign } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.replace(/^--/, ""), arr[i + 1]]);
    return acc;
  }, []),
);

const pkg = args.package || "app.suzeta";
const code = Number(args.code);
if (!Number.isInteger(code) || code <= 0) {
  console.error(`::error::--code invalid: ${args.code}`);
  process.exit(1);
}

const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!raw || raw.trim() === "") {
  console.log("::warning::PLAY_SERVICE_ACCOUNT_JSON absent — sar peste verificarea versionCode în Play.");
  process.exit(0);
}

let sa;
try {
  sa = JSON.parse(raw);
} catch {
  console.error("::error::PLAY_SERVICE_ACCOUNT_JSON nu este JSON valid.");
  process.exit(1);
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const sig = signer.sign(sa.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${sig}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token: ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;

async function api(token, path, method = "GET") {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

let token;
try {
  token = await accessToken();
} catch (e) {
  console.log(`::warning::Nu am putut obține token Play API (${e.message}) — sar peste verificare.`);
  process.exit(0);
}

let editId;
try {
  const edit = await api(token, "/edits", "POST");
  editId = edit.id;
  const bundles = await api(token, `/edits/${editId}/bundles`);
  const existing = (bundles.bundles || []).map((b) => b.versionCode).sort((a, b) => a - b);
  console.log(`versionCode-uri deja urcate în Play (${existing.length}): ${existing.join(", ") || "(niciunul)"}`);
  const max = existing.length ? Math.max(...existing) : 0;
  if (existing.includes(code)) {
    console.error(
      `::error::versionCode ${code} este DEJA urcat în Play. Play refuză releaseul ("does not add or remove any app bundles"). Rulează \`bun run version:bump\` (următorul liber: ${max + 1}).`,
    );
    process.exit(1);
  }
  if (code <= max) {
    console.error(
      `::error::versionCode ${code} <= maximul existent în Play (${max}). Utilizatorii existenți nu pot face upgrade. Setează versionCode >= ${max + 1}.`,
    );
    process.exit(1);
  }
  console.log(`✓ versionCode ${code} este liber și crescător (max în Play: ${max}).`);
} finally {
  if (editId) {
    try {
      await api(token, `/edits/${editId}`, "DELETE");
    } catch {
      /* edit-ul temporar expiră singur */
    }
  }
}
