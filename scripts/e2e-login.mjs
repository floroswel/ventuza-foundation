#!/usr/bin/env node
/**
 * Obține o sesiune Supabase PROASPĂTĂ pentru testele E2E, la runtime.
 *
 * Înlocuiește secretul static `E2E_SUPABASE_SESSION_JSON`, care conținea
 * access_token + refresh_token, expira și cerea rotație manuală. Aici se face
 * un password grant la fiecare rulare, cu contul dedicat de test:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *
 * Ce produce (formatul pe care testele îl consumă deja):
 *   LOVABLE_BROWSER_AUTH_STATUS          = injected
 *   LOVABLE_BROWSER_SUPABASE_SESSION_JSON= sesiunea, exact cum o serializează
 *                                          supabase-js în storage
 *   LOVABLE_BROWSER_SUPABASE_STORAGE_KEY = sb-<project-ref>-auth-token
 *                                          (client.ts nu setează `storageKey`,
 *                                          deci se aplică default-ul v2)
 *   LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN= access_token (sondele REST)
 *
 * Siguranță:
 *   - Nu afișează niciodată emailul, parola, access_token sau refresh_token.
 *     Fiecare valoare sensibilă trece prin `::add-mask::` înainte de orice alt
 *     output, deci o scurgere accidentală ulterioară apare redactată.
 *   - Scrie DOAR în fișierul dat cu `--out` (în afara workspace-ului, ex.
 *     $RUNNER_TEMP), niciodată în repository și niciodată în $GITHUB_ENV, ca
 *     sesiunea să ajungă exclusiv la pasul care rulează testele.
 *   - Nu creează utilizatori: dacă login-ul eșuează, iese cu cod 1.
 *
 * Utilizare:
 *   node scripts/e2e-login.mjs --out "$RUNNER_TEMP/e2e-session.env"
 */
import { writeFileSync } from "node:fs";

const REQUIRED_SECRETS = ["E2E_TEST_EMAIL", "E2E_TEST_PASSWORD"];
const log = (line) => process.stdout.write(`${line}\n`);
const isCI = Boolean(process.env.GITHUB_ACTIONS);

const outIndex = process.argv.indexOf("--out");
const outFile = outIndex !== -1 ? process.argv[outIndex + 1] : null;
if (!outFile) {
  log("::error::Lipsește --out <fișier>. Sesiunea nu se scrie niciodată pe stdout.");
  process.exit(1);
}

// 1) Secretele contului de test — mesaj cu NUMELE secretului, nimic altceva.
const missing = REQUIRED_SECRETS.filter((name) => !(process.env[name] ?? "").trim());
if (missing.length) {
  for (const name of missing) {
    log(`::error::Secretul ${name} lipsește. Adaugă-l în GitHub → Settings → Secrets and variables → Actions.`);
  }
  log(
    "::error::Testele autentificate nu pot rula fără contul dedicat de test. Nu se creează utilizatori automat și nu se marchează teste ca skip.",
  );
  process.exit(1);
}

// 2) Configurația publică (rezolvată anterior de scripts/resolve-public-env.mjs).
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").trim();
const ANON_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const PROJECT_REF = (process.env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
for (const [name, value] of [
  ["VITE_SUPABASE_URL", SUPABASE_URL],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", ANON_KEY],
  ["VITE_SUPABASE_PROJECT_ID", PROJECT_REF],
]) {
  if (!value) {
    log(`::error::${name} lipsește — rulează întâi scripts/resolve-public-env.mjs.`);
    process.exit(1);
  }
}

const email = process.env.E2E_TEST_EMAIL.trim();
const password = process.env.E2E_TEST_PASSWORD;

// Mască ÎNAINTE de orice apel, ca nici un output ulterior să nu poată expune
// credențialele (inclusiv un stack trace neprevăzut).
if (isCI) {
  log(`::add-mask::${email}`);
  log(`::add-mask::${password}`);
}

// Notă: după apeluri fetch NU folosim `process.exit()`. Cu socket-uri undici încă
// deschise, Node pe Windows cade cu o aserțiune libuv
// (`!(handle->flags & UV_HANDLE_CLOSING)`) și întoarce 127 în loc de 1. Setăm
// `process.exitCode` și returnăm, lăsând runtime-ul să închidă handle-urile.
async function login() {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    log(`::error::Nu am putut contacta Supabase Auth: ${err?.name ?? "eroare de rețea"}.`);
    return null;
  }

  if (!res.ok) {
    // Doar status + cod de eroare; niciodată credențialele sau corpul integral.
    let code = "";
    try {
      const body = await res.json();
      code = body?.error_code || body?.error || body?.msg || "";
    } catch {
      /* corp neparsabil */
    }
    log(`::error::Autentificarea contului de test a eșuat (HTTP ${res.status}${code ? `, ${code}` : ""}).`);
    log(
      "::error::Verifică E2E_TEST_EMAIL / E2E_TEST_PASSWORD și că respectivul cont există și are emailul confirmat. Nu se creează utilizatori automat.",
    );
    return null;
  }

  const parsed = await res.json();
  if (!parsed?.access_token || !parsed?.refresh_token) {
    log("::error::Răspunsul Supabase nu conține o sesiune completă (access_token/refresh_token).");
    return null;
  }
  return parsed;
}

const session = await login();
if (!session) {
  process.exitCode = 1;
} else {

// `_isValidSession` din auth-js cere access_token + refresh_token + expires_at
// (GoTrueClient.js:3931). Endpointul de token îl întoarce, dar îl completăm
// defensiv dacă lipsește, altfel sesiunea injectată ar fi considerată invalidă
// și ștearsă la initialize.
if (session.expires_at == null) {
  session.expires_at = Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600);
}

// Formatul stocat: fără `userStorage` configurat (cazul din
// src/integrations/supabase/client.ts), auth-js serializează sesiunea INTEGRAL,
// inclusiv `user` (GoTrueClient.js:4258-4262). Răspunsul password-grant are deja
// exact această formă.
const sessionJson = JSON.stringify(session);
// Cheia implicită: `sb-${hostname.split(".")[0]}-auth-token`
// (supabase-js/dist/index.cjs:1242). client.ts nu suprascrie `storageKey`.
const storageKey = `sb-${PROJECT_REF}-auth-token`;

if (isCI) {
  log(`::add-mask::${session.access_token}`);
  log(`::add-mask::${session.refresh_token}`);
  log(`::add-mask::${sessionJson}`);
}

writeFileSync(
  outFile,
  [
    "LOVABLE_BROWSER_AUTH_STATUS=injected",
    `LOVABLE_BROWSER_SUPABASE_SESSION_JSON=${sessionJson}`,
    `LOVABLE_BROWSER_SUPABASE_STORAGE_KEY=${storageKey}`,
    `LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN=${session.access_token}`,
    "",
  ].join("\n"),
  { encoding: "utf8", mode: 0o600 },
);

// Pregătirea contului. `SessionGuards` redirecționează forțat spre /n orice rută
// care nu e în ALLOWED_WITHOUT_BIRTHDATE (SessionGuards.tsx:74-77) când profilul
// nu are `birthdate`. `/settings` și `/profile` NU sunt în listă, deci un cont
// nepregătit face ca suitele care le folosesc să eșueze cu timeout-uri pe
// elemente inexistente — simptom greu de legat de cauză.
// Citim DOAR rândul propriu, cu tokenul propriu (permis de RLS, fără
// service_role) și raportăm doar booleeni, niciodată date personale.
const userId = session?.user?.id;
if (userId) {
  try {
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=birthdate,onboarding_completed,age_status`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` } },
    );
    if (pr.ok) {
      const rows = await pr.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        const hasBirthdate = Boolean(row.birthdate);
        const onboarded = row.onboarding_completed === true;
        log("Starea contului de test (doar indicatori, fără date personale):");
        log(`  birthdate setat: ${hasBirthdate}`);
        log(`  onboarding_completed: ${onboarded}`);
        log(`  age_status: ${row.age_status ?? "necunoscut"}`);
        if (!hasBirthdate || !onboarded) {
          log("::error::Contul de test nu este pregătit pentru suitele autentificate.");
          if (!hasBirthdate) {
            log(
              "::error::Profilul nu are `birthdate`. SessionGuards redirecționează atunci /profile și /settings către /n, deci consents_data_safety și profile_edit eșuează cu timeout pe elemente care nu se randează niciodată.",
            );
          }
          if (!onboarded) {
            log("::error::`onboarding_completed` este false, deci contul nu a trecut prin fluxul din /n.");
          }
          log(
            "::error::Pregătește contul O SINGURĂ DATĂ: autentifică-te în aplicație cu E2E_TEST_EMAIL și parcurge onboardingul din /n până la final. Nu se creează utilizatori din CI și nu se scriu date de test automat.",
          );
          process.exitCode = 1;
        } else {
          log("  → contul poate accesa /profile și /settings.");
        }
      } else {
        log("::warning::Nu am putut citi rândul de profil al contului de test (RLS sau profil inexistent).");
      }
    } else {
      log(`::warning::Verificarea stării contului a returnat HTTP ${pr.status}; continuăm.`);
    }
  } catch {
    log("::warning::Verificarea stării contului a eșuat (rețea); continuăm.");
  }
}

// Raport fără date sensibile: doar faptul că sesiunea există și cât ține.
const expiresIn = Number(session.expires_in ?? 0);
log("Sesiune de test obținută la runtime (fără secret static, fără rotație manuală).");
log(`  storageKey: ${storageKey}`);
log(`  access_token: prezent, ${String(session.access_token).length} caractere (mascat)`);
log(`  refresh_token: prezent (mascat)`);
log(`  expiră în: ${expiresIn} secunde`);
log(`  scris în: ${outFile} (0600, în afara repository-ului)`);
}
