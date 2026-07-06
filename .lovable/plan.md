# Audit ADMIN / MODERARE / DATE ANTI-ABUZ — stare reală

Zero modificări. Marcaje: **[OK]** funcționează / **[SCHELET]** există dar nu produce efect end-to-end / **[LIPSĂ]** nu există.

## A. CE EXISTĂ ACUM ÎN ADMIN

### A1. Rute și guard (`src/routes/admin.tsx`, `src/routes/admin.users.$id.tsx`)
- **[OK]** Două rute: `/admin` (dashboard cu ~40 secțiuni prin `#hash`) și `/admin/users/$id` (User 360).
- **[OK]** Guard rol client-side (`admin.tsx:326-354`): `supabase.from("user_roles").select("role")` → setează `isAdmin` / `isMod` / `isSuper`. Fără rol: toast "Acces interzis" (dar componenta rămâne montată — enforcement real e server-side prin `assertStaff` / `assertRole` în fiecare `createServerFn`).
- **[OK]** `useIdleLogout(15min)` pe sesiunile admin.
- **[LIPSĂ]** Nu există `beforeLoad` cu redirect pe `/admin` — pagina se randează scurt și apoi toast-uiește. Nu e o breșă (RPC-urile server-side gate-uiesc), dar UX-ul scapă un blink.

### A2. Acțiuni de moderare care FUNCȚIONEAZĂ acum
Pe `/admin/users/$id` (`UserActionsBar`, liniile ~453-476):
- **[OK]** `adminBanUser` — ban permanent (setează `profiles.banned_at = now, banned_reason`). Necesită `assertStaff` + `assertAdminMfa`. Scrie `admin_audit_log` severity=critical. **DAR vezi A3.**
- **[OK]** `adminUnbanUser` — resetează `banned_at=null, banned_reason=null`.
- **[OK]** `adminSuspendUser` — suspendare temporară `1–8760h` (setează `suspended_until = now + hours`). Default 24h.
- **[OK]** `adminPurgeUserAccount` — ștergere GDPR (soft prin `deletion_requests`, hard doar `super_admin`).
- **[OK]** `EditProfileDialog` (nume, bio, birthdate ≥18), `ChangeEmailDialog`, `PushUnicastDialog`, `ForceLogoutDialog`, `PasswordResetDialog`, `ResendConfirmationDialog`, `BreakGlassPanel` (orientare / locație / mesaje brute — cu justificare + audit critical).
- **[OK]** `adminApplyStrike` (strike-uri graduale, `admin_apply_strike` RPC), `adminSetTemporaryBan` (`admin_set_temporary_ban`), `adminSetLegalHold` — expuse în `EnterpriseUser360Panel` (drawer, nu pagina $id).

Pe `/admin#reports` (`ReportsPanel`, `admin.tsx:1243-1440`):
- **[OK]** Listează `reports` cu `status='pending'` + profil raportat, cu acțiuni:
  - `moderator_suspend_user(target, hours, reason)` [OK]
  - `moderator_ban_user(target, reason)` [OK] — setează `banned_at + suspended_until=+100y`
  - `resolve` / `dismiss` — update `reports.status`.
- **[LIPSĂ]** Fără câmp "warn" în UI (există `profiles.warned_at / warned_reason` dar nu există `adminWarnUser` server fn).

Pe `/admin#userops` (`OperationsUserOpsPanel` → `adminBulkUserAction`):
- **[OK]** Acțiuni bulk: ban / unban / suspend / unsuspend / verify / unverify pe listă de user_id.

### A3. Ban temporar vs permanent — STARE CRITICĂ
Există **trei coloane paralele** pe `profiles`, cu enforcement diferit:

| Coloană | Setată de | Verificată de `assert_account_usable` |
|---|---|---|
| `banned_at` (timestamptz) | `adminBanUser`, `moderator_ban_user`, `adminBulkUserAction` | **NU** |
| `banned_until` (timestamptz) | DOAR `admin_set_temporary_ban` RPC | **DA** (`account_temporarily_banned`) |
| `suspended_until` (timestamptz) | `adminSuspendUser`, `moderator_suspend_user`, `moderator_ban_user` (=+100y), trigger `auto_soft_ban_on_reports` | **NU** |

**Consecință:** un user "banat permanent" cu `adminBanUser` NU e blocat la login și trece prin `assert_account_usable`. Este filtrat din `discover_profiles` (WHERE `banned_at IS NULL AND (suspended_until IS NULL OR < now())`), este filtrat din listing-uri admin, și fingerprints-ul lui e propagat automat în `banned_fingerprints` (trigger `ban_user_fingerprints`) — la următorul login de pe același device, `SessionGuards → useDeviceFingerprint → is_fingerprint_banned` îl semnează afară. **Dar sesiunea actuală rămâne validă** și RPC-urile care nu apelează `assert_account_usable` nu-l opresc.

Ban "hours/days/permanent" ca UI unificat: **[LIPSĂ]**. Ai piese separate (`adminSuspendUser` = ore, `adminBanUser` = permanent-fără-gate, `admin_set_temporary_ban` = ore/zile-cu-gate dar neexpus).

### A4. Sistem rapoarte
- **[OK]** Userii raportează prin `ReportBlockDialog` (`src/components/ReportBlockDialog.tsx`) → `INSERT public.reports (reporter_id, reported_id, reason, details)`. RLS: `any user can report` (`WITH CHECK auth.uid()=reporter_id`).
- **[OK]** Adminul vede: `ReportsPanel` (pending list) + `AppealsPanel` (contestații ban/suspend prin `appeals`) + `nearby_user_reports` (raportări specifice discover).
- **[OK]** Auto-escalare: trigger `auto_soft_ban_on_reports` — la ≥5 raportori distincți/30 zile, setează `suspended_until = now + 72h` automat.
- **[LIPSĂ]** Fără categorii DSA/severity, fără atribuire moderator (există coloanele `assigned_moderator_id, assigned_at` pe reports dar nu sunt folosite în UI), fără notificare raportor la rezolvare.

### A5. Ce vede adminul când deschide un user (`/admin/users/$id` + `adminGetUserActivity`)
- Header: `display_name, verified, banned_at, suspended_until, partner_suspended_at, deleted_at, report_count`.
- Profil (~215-260): display_name, bio, birthdate (an), gen, orientare, pronume, oraș, verified, `risk_score`, `warned_at/reason`.
- Auth: email, email_confirmed_at, providers, last_sign_in_at, created_at.
- Devices: `device_fingerprints` — **mascate** (`fingerprint_prefix` primele 8 caractere + "…", `ua_family` regex Chrome/Firefox/…). Fingerprint brut și UA complet DOAR prin break-glass.
- Subscriptions, invoices (partner), push_subscriptions (kind/platform/created_at), risk_flags, deletion_requests.
- Reports făcute / primite (id, reason, status, created_at, counterpart_id).
- Consimțăminte (`consent_log` cu kind/version/accepted/ua_family).

**NU vede în listing:** IP real, UA complet, endpoint push, mesaje brute, coordonate, HIV, orientare (Art. 9 — necesită break-glass).

## B. DATE ANTI-ABUZ ÎN DB (verificat pe schemă)

### B1. IP — stocat?
- **profiles / sessions:** NU. Zero coloană `ip`, `ip_address`, `last_ip` pe `profiles`.
- **admin_audit_log:** `ip inet` (10 rânduri populate) — DOAR pentru acțiuni admin.
- **admin_impersonation_log:** `ip inet` — DOAR pentru impersonări admin.
- **admin_login_attempts:** `ip inet` — schemă există, 0 rânduri (nu e cablat la login-ul admin).
- **consent_log:** `ip inet` — la fiecare consimțământ (opțional).
- **verification_requests:** `ip_hash` (SHA-256, ireversibil).
- **signup_attempts:** `ip_hash` (SHA-256 sărat) — captat prin `/api/public/signup-guard` (verifică `check_signup_throttle` cu cap 5/h + 20/d per IP, 3/h + 10/d per fingerprint).

**Concluzie:** IP real per user (pentru "ban pe IP") **NU se stochează nicăieri**. Doar hash-uri sărate pentru rate-limit anti-bot, ireversibile.

### B2. Device / user_agent / platform
- **device_fingerprints:** `fingerprint text, user_agent text, first_seen_at, last_seen_at` — populat de `useDeviceFingerprint` (canvas + WebGL + UA + timezone + screen, SHA-256 local) montat prin `<SessionGuards />` în `__root.tsx`. **6 useri, 17 rânduri.**
- **banned_fingerprints:** `fingerprint text PK, reason, banned_by, banned_at` — 0 rânduri. Populat automat de trigger `ban_user_fingerprints` când `profiles.banned_at` devine NOT NULL.
- **push_subscriptions:** platform (fcm/apns/web), kind — sensibile (endpoint/auth/p256dh mascate).

**Concluzie:** device fingerprint funcționează end-to-end pentru evazare-ban pe același browser. NU rezistă la reinstalare browser / mod incognito / device nou.

### B3. Tabele de moderare (verificate)
- **[OK]** `reports` (id, reporter_id, reported_id, reason, details, status, resolved_by, resolved_at, moderator_notes, assigned_moderator_id, assigned_at, is_seed) — 0 rânduri live.
- **[OK]** `blocks` (blocker_id, blocked_id).
- **[OK]** `user_strikes` (severity, reason, reason_code, decay_at, revoked_at) — 0 open.
- **[OK]** `admin_audit_log` (actor, action, target_table/id, before/after jsonb, justification, ip, ua, severity) — append-only prin trigger.
- **[OK]** `admin_sensitive_access_log` (break-glass — separat de audit).
- **[OK]** `admin_impersonation_log`, `admin_ip_allowlist`, `admin_mfa_status`, `admin_login_attempts`.
- **[OK]** `appeals` (contestații), `deletion_requests` (GDPR), `nearby_user_reports`, `risk_flags`, `csam_reports`, `illegal_content_reports` (DSA), `breach_incidents` (GDPR Art. 33/34).
- **[OK]** `rate_limit_log`, `signup_attempts`, `signup_throttle_logs`, `banned_fingerprints`.

### B4. profiles.location — PostGIS real
- Tip: `USER-DEFINED / geography` (PostGIS). La fel `travel_location`, `prev_location`.
- **RLS pe profiles.SELECT: `auth.uid() = id`** — un user vede DOAR propriul rând. Toți ceilalți userii NU pot citi direct `location`.
- Adminul citește **doar prin `supabaseAdmin` (service_role)** + break-glass logat critical (`adminBreakGlassReveal({kind:'location'})` — necesită super_admin).
- Discover expune DOAR `bucket_distance_m(dist_m)` (bucketized, nu coordonate brute).
- **Concluzie:** coordonate reale există în DB și sunt accesibile adminului DOAR prin break-glass. Politica de privacy este respectată.

## C. CE LIPSEȘTE PENTRU CERINȚELE FONDATORULUI

### C1. Ban pe ore/zile/permanent — unificare
- **Există fragmentat**, cu semantică inconsistentă:
  - `adminSuspendUser` — ore (1–8760), setează `suspended_until`, NU e enforced la login.
  - `admin_set_temporary_ban` (RPC) — timestamp `banned_until`, ENFORCED la login prin `assert_account_usable`. **Neexpus în UI.**
  - `adminBanUser` — permanent, setează `banned_at`, NU e enforced la login (dar filtrează din feeds + propagă la banned_fingerprints).
- **Lipsă concretă:** un singur dialog "Ban: temporar (h/zile) / permanent" care să:
  1. Folosească `admin_set_temporary_ban` (`banned_until = now + duration`) pentru temporar → login se blochează;
  2. Folosească `banned_at + banned_until = 'infinity'` pentru permanent → login se blochează + fingerprints propagate;
  3. Adauge verificarea `banned_at IS NOT NULL OR banned_until > now()` în `assert_account_usable` (schimbare SQL) — altfel banul "permanent" curent tot nu blochează sesiunea existentă.

### C2. Ban pe IP
- **Fezabil parțial:** IP-ul poate fi captat la login/signup din `cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` (există deja pattern-ul în `signup-guard.ts` + `business-apply.functions.ts`).
- **Ce lipsește:**
  - O tabelă `banned_ips` (analogă cu `banned_fingerprints`, dar cu `ip_hash text PK, banned_by, reason, banned_at, expires_at`).
  - Captare IP la fiecare login (edge / server fn triggered de `SIGNED_IN` sau într-un endpoint `/api/public/login-guard`).
  - Verificare la login (SessionGuards → RPC `is_ip_banned(_ip_hash)` similar cu `is_fingerprint_banned`).
- **Trade-off privacy/GDPR:** IP e dată personală. Stocarea trebuie declarată în `docs/gdpr-art-30-register.md` + `legal.subprocessors.tsx` (Cloudflare deja e menționat pentru transport, dar stocarea per-user devine scop nou). Recomandare: **doar hash sărat** (ca la signup), nu IP clar.

### C3. Detectare conturi duble ale unui banat
- **Semnale reale disponibile:**
  - `device_fingerprints` (canvas/WebGL/UA hash) — deja folosit. `FraudClusterPanel` există în `/admin`.
  - `signup_attempts.ip_hash + fingerprint` — 30 zile retenție.
  - Email pattern — analiza `+alias`, `.dot.tricks`, domenii disposable (LIPSĂ ca funcție DB dedicată).
- **Lipsă:** Un endpoint `admin_find_related_accounts(user_id)` care întoarce user_id-uri cu overlap pe fingerprint / ip_hash și marchează clusterul; acțiune bulk "ban cluster" (există bulk ban, dar fără suggestion cluster).

### C4. "Locație reală / țară / dispozitiv" pentru admin
- **Coordonate exacte:** există în `profiles.location` (PostGIS geography) — deja accesibile adminului DOAR prin `adminBreakGlassReveal({kind:'location'})` (super_admin + justificare + audit critical). **Nu e nevoie de nimic nou. Contrazicerea privacy policy nu există dacă păstrăm ruta break-glass** — regula spune "către alți useri", nu "către super_admin cu break-glass".
- **Țară:** NU există coloană `country` pe `profiles`. Există `travel_city text` (self-declared, opțional).
- **Dispozitiv:** `device_fingerprints.user_agent` (brut în DB, mascat `ua_family` în UI). Break-glass pe `device` NU există ca `kind` — s-ar putea adăuga (`adminBreakGlassReveal({kind:'device'})`).
- **Lipsă concretă:** dacă vrei "vezi țara userului fără break-glass", trebuie derivare din IP la login (GeoIP → country_code text pe profil sau într-o tabelă separată). Necesită subprocessor GeoIP (Cloudflare are `cf-ipcountry` header GRATIS, fără subprocessor nou) și actualizare Art. 30 + subprocessors + confirmare temei legal Art. 6.

## Sumar rapid pentru decizii

| Cerință fondator | Stare reală | Efort până la funcțional |
|---|---|---|
| Ban 24h/7z/30z/permanent unificat, enforced la login | Fragmentat; permanent nu blochează sesiunea | mediu (1 dialog UI + patch `assert_account_usable` + 1 server fn) |
| Ban pe IP | IP nu se stochează per-user | mare (captare IP la login + tabelă + gate + audit + Art. 30) |
| Detectare conturi duble | Fingerprint OK; fără clustering server-side | mediu (RPC + UI în FraudClusterPanel) |
| Vezi locația reală ca super_admin | Există (break-glass) | zero |
| Vezi țara userului | Nu — nu se derivă din IP | mic (Cloudflare `cf-ipcountry` la login → coloană `last_country_code`) |
| Vezi dispozitivul | Mascat; brut prin break-glass (kind lipsă) | mic (extindere break-glass kind='device') |

Aștept decizie pe ce sprint(uri) execuți întâi.