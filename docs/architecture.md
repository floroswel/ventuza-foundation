# Suzeta — Arhitectură tehnică (due diligence)

Versiune: 1.0 · Actualizat: 2026-07-13

Document de referință pentru audit tehnic / due diligence la achiziție.

## 1. Stivă

| Strat | Tehnologie |
|---|---|
| Client web + Android | React 19, TanStack Start v1 (SSR), Vite 7, Tailwind CSS v4 |
| Aplicație nativă | Capacitor (Android, `compileSdk 36` / `targetSdk 35`), iOS pregătit (necompilat) |
| Backend | Lovable Cloud (Supabase gestionat): Postgres + PostGIS, Auth, Storage, Realtime |
| Logică server | `createServerFn` (TanStack Start) pe runtime edge (Cloudflare Workers) |
| Email | Infrastructură de email gestionată Lovable Cloud |
| Push | Web Push (VAPID) + FCM nativ Android |
| Verificare vârstă | Didit (age estimation, selfie tranzitoriu, șters imediat) |
| CI/CD | GitHub Actions → build AAB → Play Store (track internal, rollout etapizat) |

## 2. Limitele server/client

- Cod client: componente, hooks, `src/lib/*.ts` (fără sufix `.server.ts`).
- `createServerFn` în `src/lib/*.functions.ts` — importabile din client, dar executate pe server.
- Helperi server-only: `src/lib/*.server.ts` — blocați din bundle-ul client prin import protection.
- `SUPABASE_SERVICE_ROLE_KEY` folosit DOAR prin `supabaseAdmin`, importat dinamic în interiorul handlerelor (`await import('@/integrations/supabase/client.server')`), niciodată la module scope.
- Funcții autentificate: middleware `requireSupabaseAuth` — RLS se aplică ca userul curent.
- Webhookuri/cron: rute `src/routes/api/public/*` cu verificare de semnătură/token în handler (HMAC pentru Didit, bearer intern pentru cron).

## 3. Model de securitate

### 3.1 Autentificare
- Email + parolă (OAuth Google eliminat la cererea produsului).
- Cloudflare Turnstile pe formularele auth (anti-bot), fail-open dacă nu e configurat.
- Confirmare email obligatorie: `public.assert_account_usable()` blochează orice RPC social fără `email_confirmed_at`.

### 3.2 Age gate (18+)
- Sursa de adevăr: `profiles.age_status`, setat EXCLUSIV de `didit_apply_result` (webhook Didit, HMAC verificat).
- Enforcement DB: trigger + `assert_account_usable()` / `assert_age_verified()` în toate RPC-urile sociale.
- Enforcement UI: `<AgeGate>` în root layout; `shouldEnforceAgeGate()` forțează ON în producție indiferent de feature flag.
- Reconciliere: sesiuni Didit `pending` > 1h re-sincronizate automat la 15 min (pg_cron → `POST /api/public/cron/didit-reconcile` → re-poll API Didit). Endpoint manual: `/api/public/didit-sync`.

### 3.3 RLS și date sensibile
- RLS activ pe toate tabelele cu date de utilizator; GRANT-uri explicite per tabel.
- Locație precisă: niciodată returnată altor useri. Doar distanță bucketizată prin `public.bucket_distance_m()`. Coloanele `location`/`travel_location`/`prev_location` citibile doar de owner (RLS) și de funcții SECURITY DEFINER.
- Date de sănătate (Art. 9): criptate la nivel de coloană (`pgcrypto`, `*_enc bytea`); decriptare DOAR prin RPC-uri SECURITY DEFINER grant-uite exclusiv `service_role` (`get_user_health`/`set_user_health`); cheia în secret de infrastructură.
- Consimțăminte: registrul autoritativ `public.consent_kinds()` + mirror TS `src/lib/consent-registry.ts`; scriere prin `record_consent`; retragere cu cascadă de ștergere (triggere).
- Admin: RBAC server-side (`has_role`), audit complet în `admin_audit_log` (append-only), break-glass obligatoriu pentru date sensibile (`admin_sensitive_access_log`), MFA obligatoriu pentru acțiuni distructive.
- CSAM: conținutul suspect NU se randează niciodată; hash-blocklist + raportare.

### 3.4 Rate limiting
- `discover_profiles`: hard cap absolut 50 profiluri/cerere și 60 cereri/oră/user (constante în funcție, nedepășibile). Valorile efective se citesc din `app_settings.discover_limits` — pot doar micșora plafoanele, fără redeploy.
- Log în `rate_limit_log`; curățare > 7 zile prin `cleanup_rate_limit_log()` (service_role).
- Invarianții sunt verificați automat: `security_invariants_snapshot()` (service_role) + test unitar `src/lib/__tests__/security-invariants.test.ts` + panou admin.

## 4. Date — tabele cheie

- `profiles` (131 coloane): profil user, locație PostGIS, flags confidențialitate, `discreet_avatar`.
- `messages` / `conversations`: mesagerie; block bilateral enforced la DB (trigger).
- `photo_reviews`: coada de moderare foto (profil = fără nuditate; album privat = fără minori/arme/sânge). Nuditate adultă la profil → mutare automată în albumul privat.
- `verification_requests`/`didit_sessions`: verificare vârstă (Didit activ; flux intern liveness dormant).
- `app_settings`: parametri de business (niciodată hardcodați); `feature_flags`: kill-switches.
- `venues`/`events`/`offers`: conținut partener, publicare DOAR prin moderare staff (`admin_moderate_item`).
- `admin_audit_log`, `admin_sensitive_access_log`: audit append-only.

## 5. Fluxuri critice

### 5.1 Signup → acces
1. `signUp` (Turnstile) → email confirmare.
2. Onboarding `/n` (birthdate obligatoriu, trigger DB refuză <18 ani).
3. Consimțăminte în `consent_log` ÎNAINTE de orice prelucrare opt-in.
4. Didit age verification → webhook HMAC → `didit_apply_result` → `age_status='verified'`.
5. Fallback: re-poll la 15 min (cron) + buton manual de sincronizare în UI.

### 5.2 Mesagerie
- Insert blocat de DB dacă există block bilateral (`trg_prevent_message_when_blocked`).
- Rate limit + `assert_account_usable()` pe RPC-urile de trimitere.

### 5.3 Moderare foto
- Upload profil → `photo_reviews` (pending) → scan AI (clasificare) → reguli:
  - minori/arme/sânge → respins + escaladare (oricare context);
  - nuditate adultă la poză de profil → mutată automat în album privat + toast explicativ;
  - altfel → aprobare (auto sau manuală).
- Panou admin: coadă dedicată + buton „Scanare poze existente" (retroactiv).

### 5.4 Push
- Înregistrare: Web Push / FCM nativ, token în `push_subscriptions`.
- Dispatch: server fns; tokenuri moarte (410/404) șterse automat.
- Canale Android + banner update disponibil în app.

## 6. CI/CD și release

- GitHub Actions: build AAB (signing din secrets), injectare `google-services.json` din `GOOGLE_SERVICES_JSON_BASE64`, injectare SHA-256 în `assetlinks.json` (App Links), upload Play track `internal`, rollout etapizat.
- Versiuni: `android/app/build.gradle` + changelogs localizate.
- ProGuard/R8: reguli pentru Capacitor, păstrarea claselor native; `FLAG_SECURE` pe ecrane sensibile; root detection (RootBeer).

## 7. Monitorizare & SLA

- `admin_sla_telemetry` (`src/lib/admin-sla-telemetry.ts`): timpi de rezolvare moderare/rapoarte, clasificare SLA.
- Panouri admin: fiecare expune loading / error (cu „Acces refuzat" pe 403) / empty legitim.
- `security_invariants_snapshot()` verifică în DB că gate-urile critice nu au fost modificate.

## 8. Riscuri cunoscute / datorie tehnică

| Risc | Stare | Mitigare |
|---|---|---|
| Provider unic age-verification (Didit) | Acceptat | Re-poll automat + manual sync; interfață pregătită pentru al doilea provider |
| Fără iOS | Programat | Capacitor pregătit; necesită cont Apple Developer |
| Testare e2e limitată | În curs | Suite Playwright pe fluxurile critice (auth, chat, block) |
| Monorepo client+admin+partner | Acceptat | Separare prin import protection + RBAC server-side |

## 9. Conformitate

- GDPR: registrul Art. 30 (`docs/gdpr-art-30-register.md` + `/legal/records-of-processing`), subprocesatori (`/legal/subprocessors`), DPO publicat în Privacy Policy (`dpo@suzeta.ro`), cookie banner, centru cereri GDPR.
- DSA: punct unic de contact + rapoarte anonime (`illegal_content_reports`, identitatea raportorului stripped).
- Documente legale P0: terms/privacy/cookies/community/safety/age-policy/dmca/dsa — toate cu conținut real, linkate din Settings.
