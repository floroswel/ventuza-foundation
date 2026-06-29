## Audit de securitate — RAPORT (zero modificări)

Scop: vulnerabilități reale pentru o aplicație cu date Art. 9 (HIV, orientare), minori și locație. Doar analiză.

---

### 🔴 CRITICE
**Niciuna confirmată.** Toate vectorii cu impact direct (escaladare rol, citire HIV/locație altui user, ocolire block, signup minor) sunt blocați la DB prin RLS + triggere + RPC SECURITY DEFINER. Detalii în secțiunile de mai jos.

---

### 🟠 MEDII

**M1. Endpoint-uri publice fără rate limit / captcha**
- `src/lib/business-apply.functions.ts → submitBusinessApplication` — server fn fără `requireSupabaseAuth`. Combinat cu RLS `business_applications` `WITH CHECK (accepts_*)`, oricine poate insera N aplicații/secundă. Impact: poluare tabel, alerte false în admin, costuri storage.
- `src/lib/anaf.functions.ts → lookupAnafCui` — public, proxy către ANAF. Abuz → IP ban ANAF pentru tot proiectul (DoS auto-inflict).
- `illegal_content_reports` RLS `INSERT TO public WITH CHECK (true)` (DSA, intenționat anonim) — fără rate limit aplicativ. Spam → coada DSA admin inutilizabilă.
- **Atacator poate:** umfla cozile admin, bloca lookup CUI pentru parteneri legitimi.

**M2. `admin_*` SECURITY DEFINER au `GRANT EXECUTE` și pentru `anon`**
Verificat în `pg_proc.proacl`: `admin_update_setting`, `admin_confirm_invoice_payment`, `admin_cancel_invoice`, `admin_moderate_item`, `admin_suspend_partner`, `admin_reinstate_partner`, `admin_analytics_summary`, `admin_can_access_sensitive`, `admin_get_my_role` apar cu `anon=X/postgres`.
Funcțiile verifică intern `has_role`/`is_staff` și aruncă `forbidden`, deci nu sunt exploatabile direct. Dar suprafața de atac este mai largă decât necesar: orice bug viitor în check intern devine RCE-level pentru un user neautentificat. Best practice: `REVOKE EXECUTE ... FROM anon, PUBLIC; GRANT EXECUTE ... TO authenticated;`.
- **Atacator poate:** azi, doar enumera existența funcției. Dacă o refactorizare scoate accidental `has_role` din vreuna → escaladare instant din anon.

**M3. `app_settings` și `feature_flags` complet publice către `anon`**
Politici `USING (true)` pentru ambele tabele.
- `billing_settings` expune anon: nume firmă, CUI, IBAN, bancă, **email `business@`**, **telefon `+40753326405`**, adresă completă. Telefon + email contact + adresă fizică sunt PII vizibile fără login.
- `rate_limits.messages_per_min`, `proximity_notifications` (cooldown, daily cap, quiet hours, max radius), `partner_quotas` — un atacator știe exact pragurile anti-spam și le poate evita.
- `feature_flags` — atacatorul vede ce flag-uri sunt OFF (ex. `age_verification` în staging) și poate ținti acele medii.
- **Atacator poate:** harvest contact owner pentru phishing/swat, tuning evaziune anti-spam, recon medii non-prod.

**M4. `policy_versions` permite `SELECT TO public USING (true)` — OK; dar `app_settings_history` are RLS pe staff (OK).** Nu e vulnerabilitate, doar confirmare.

---

### 🟡 MINORE

**m1. `spatial_ref_sys` fără RLS** — tabel PostGIS de referință, doar metadate SRID publice. Nicio acțiune.

**m2. `rate_limit_log` are RLS ON dar 0 policies** — efectiv read/write blocat pentru `authenticated`/`anon` (doar `service_role` operează). Sigur acum, dar dacă vreodată muți scrierea din SQL/SECURITY DEFINER în client, se va rupe silent.

**m3. `consent_log` SELECT include `is_admin_or_above`** — adminii pot vedea consimțămintele oricărui user fără break-glass. Conform regulii break-glass, accesul la `messages`/`location`/`health` trece prin RPC dedicat; `consent_log` nu e clasificat la fel. Recomandare: log audit la citirile cross-user (sau restrânge la `auditor`/`super_admin`).

**m4. `device_fingerprints` SELECT doar owner — OK**, dar `nearby_user_reports`, `risk_flags`, `csam_reports` accesibile staff fără logare audit per-read (logarea există doar pentru break-glass). Recomandare: jurnal de read pe `csam_reports`.

**m5. `business_applications` SELECT include `user_id = auth.uid()`**, dar `business_applications` SELECT pentru aplicațiile **anonime** (cu `user_id IS NULL`) este invizibil userului care le-a trimis până la link prin email. Nu e vuln, dar UX→ poate părea „aplicația mea a dispărut".

**m6. `submitBusinessApplication` — extragerea `userId` din header se face cu `supabase.auth.getUser()` pe client publishable**, fără verificare claims pe `getClaims`. Suficient (Supabase validează tokenul la server), dar dacă tokenul e expirat, `userId` rămâne null fără semnal → aplicație devine orfană silent. Nu e vuln, e edge case UX.

**m7. `enforce_min_age_trg` validează vârsta doar la `birthdate` non-null.** OAuth signup fără birthdate este capturat de `SessionGuards.tsx` care redirecționează către `/n`. Guard-ul rulează în React → util pe web, dar în Capacitor (Android) între relogări poate exista o fereastră scurtă fără verificare. Toate fluxurile sensibile (mesaje, swipe, profil altui user) trec prin RLS/SECURITY DEFINER care nu depind de birthdate, deci impact real = zero, dar e bine de știut.

---

### ✅ CONFIRMAT SIGUR

**Locație (regulă permanentă)**
- `public.profiles.location` SELECT RLS: `auth.uid() = id` (owner-only). Verificat.
- `discover_profiles` și RPC-urile nearby returnează doar `distance_bucket` (via `bucket_distance_m`). Niciun `ST_X/ST_Y/ST_AsText` proiectat la alt user.
- `SessionGuards.tsx → update_my_location` trimite coordonatele exclusiv pentru owner → coloana `location` privată.

**Date HIV / Art. 9 (regulă permanentă)**
- `hiv_status_enc`, `hiv_test_date_enc` (bytea) — RLS profiles owner-only + trigger `prevent_profile_privilege_escalation` blochează scrierea directă (chiar și de owner) pe coloanele enc.
- Decriptare exclusiv prin `get_user_health(uuid,text)` cu `GRANT EXECUTE TO service_role` only. Verificat în `pg_proc.proacl` — anon/authenticated nu pot apela.
- `HEALTH_COL_KEY` citit din `process.env` în `health.functions.ts` și `admin-break-glass.functions.ts`. Nu apare hardcodat sau în `import.meta.env`.
- Triggerul `enforce_health_consent` operează pe `*_enc IS NOT NULL` — fără decriptare la check.
- Cascade `withdraw_health_consent` setează enc pe NULL în tranzacție.

**Escaladare privilegii**
- `prevent_profile_privilege_escalation` trigger (BEFORE UPDATE) resetează: `verified`, `verified_at`, `age_*`, `banned_*`, `suspended_*`, `warned_*`, `report_count`, `risk_*`, `boost*`, `super_taps_balance`, `xp`, `level`, `streak_days`, `partner_suspended_at`, `health_data_consent_at`, `hiv_*_enc`, `id`, `created_at`, `profile_slug`, `deleted_at`. Doar service_role/postgres bypass.
- `profiles` nu are coloane `premium_until`, `founder_grant`, `is_admin` (verificat în `information_schema.columns`). Premium-ul se calculează prin `subscriptions` (RLS owner-read), `founder_grants` separat.
- `user_roles` RLS: insert/update doar prin `has_role('admin')`. User normal NU se poate self-grant.
- Admin server-fn-urile gated pe `assertAdmin`/`assertStaff` + `assertAdminMfa` pentru cele distructive (ban, suspend, purge, role, break-glass).

**Block bilateral**
- Triggerul `trg_prevent_message_when_blocked` BEFORE INSERT pe `messages`. RLS UI vine în plus, dar DB e ground-truth.

**Conversații / mesaje / private albums**
- `messages` RLS scoped la `is_conversation_participant` — owner-only.
- `conversations` SELECT/INSERT/UPDATE doar `user_a OR user_b`.
- `private_albums` viewer-only prin `album_unlocks` join.

**Storage buckets**
- Verificat anterior: toate private (`public=false`), policies scoped pe `{uid}/...`. `venue-media` read deschis `authenticated` by design (poze venue publice).

**Auth / signup**
- Supabase email + OAuth Google. `SessionGuards` forțează `/n` dacă birthdate lipsește. `enforce_min_age` refuză <18 la DB.

**Edge functions**
- Webhook `api/public/google-play-rtdn` și `age-webhook` au verificare semnătură (HMAC / JWT validation). `billing-tick` rulează cron — nu acceptă input user.

**`admin_audit_log` append-only** — trigger `prevent_audit_mutation` (verificat indirect prin reguli).

---

### RECOMANDĂRI ORDONATE DUPĂ ROI

1. **REVOKE EXECUTE ON FUNCTION admin_* FROM anon, PUBLIC;** (M2) — 5 minute, închide o suprafață majoră.
2. **Restrânge `app_settings` SELECT** — politică nouă: doar `discover.*`, `proximity_notifications.default_radius_m`, `partner_quotas` (read public minim), restul `authenticated`-only sau staff-only. Mută `billing_settings` și `rate_limits.*` în staff. (M3)
3. **Rate limit la nivel de DB/Edge** pentru `submitBusinessApplication`, `lookupAnafCui`, `illegal_content_reports` (M1). Tabel `rate_limit_log` deja există — folosește `try_rate_limit(kind, key)`.
4. **Audit log la citirile staff pe `csam_reports`, `nearby_user_reports`, `consent_log` cross-user** (m3, m4).
5. **Adaugă policy pe `rate_limit_log`** care permite scriere service_role explicit + read staff (m2).

---

### Verdict
Aplicația are un nivel de securitate **peste media app-urilor dating LGBTQ+**. Datele Art. 9 (HIV, orientare, locație) sunt corect blindate prin RLS + triggere + RPC SECURITY DEFINER cu cheie pe server. Nu există vector critic exploatabil acum. Cele 4 puncte 🟠 sunt de „surface hardening" — utile înainte de publicare pe Play Store, dar nu blocante legal/securitate.