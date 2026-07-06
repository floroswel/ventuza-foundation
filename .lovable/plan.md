## Ce livrez în acest sprint

### A. Modul admin User360 — 10 must-have-uri enterprise

1. **Timeline unificat** (`/admin/users/$id` tab nou "Timeline") — feed cronologic ordonat descrescător care agregă: `admin_audit_log`, `consent_log`, `verification_requests`, `reports` (reporter+target), `appeals`, `deletion_requests`, `partner_status_notifications`, sancțiuni (ban/suspend/shadowban), plăți (`partner_invoices`), sesiuni admin (login attempts). Filtre: tip eveniment, interval date. Server fn `adminGetUserTimeline`.

2. **Identități legate** (tab "Identities") — vedere agregată: emailuri istorice (auth), telefon, `device_fingerprints`, IP-uri distincte + geo aproximativ, useri care partajează același fingerprint/IP (cluster detection). Server fn `adminGetLinkedIdentities`.

3. **Ban temporar cu expirare automată** — coloană nouă `profiles.banned_until timestamptz`. Trigger `expire_temporary_bans` (rulat de `assert_account_usable`) ridică automat banul la expirare. UI: buton "Ban temporar" cu selector durată (1h/24h/7z/30z/custom).

4. **Strike counter progresiv** — tabel `user_strikes` (user_id, reason, severity, decay_at, issued_by, created_at). Funcție `apply_strike(user, reason, severity)` care aplică automat sancțiune escaladată: 1 = warning, 2 = mute 24h, 3 = shadowban 7z, 4 = ban 30z, 5 = ban permanent. Strike-urile expiră după 90 zile (decay). Panou în tab User360.

5. **Mesaj oficial in-app** — server fn `adminSendOfficialMessage(user_id, body, subject)` trimite un mesaj din contul de sistem `ventuza-support` (creat la migrare). Apare în inbox-ul userului cu badge "Oficial Ventuza" (nu doar push).

6. **LTV & sumar financiar** (tab "Financial") — total plătit, MRR curent, invoice count, refunds, chargebacks, plan history. Din `partner_invoices` + `partner_subscriptions`.

7. **2FA status vizibil** — coloană în header user360 cu badge verde/roșu din `admin_mfa_status` + istoric enrollment. Buton "Force re-enroll 2FA" (super_admin).

8. **Legal hold** — coloană `profiles.legal_hold boolean`. Când e `true`, `adminProcessDeletion` refuză cu `legal_hold_active`. Rațiune obligatorie în audit. Doar super_admin.

9. **Assign to moderator + SLA countdown** — coloană `assigned_moderator_id` + `assigned_at` pe `reports` și `verification_requests`. UI: dropdown atribuire în cozi, countdown vizual (verde <2h, galben 2-6h, roșu >6h).

10. **Foto istoric admin** — vedere read-only în tab "Media" cu photo history + reverse-image marker (pHash match cu `photo_hashes` blocked).

### B. Sistem badge-uri custom (fondator, ONG, bar, verified partner)

**Extinde `badge_registry`** cu:
- `is_manual boolean` — dacă badge-ul se acordă manual de admin (nu auto).
- `effect text` — `null | 'shimmer' | 'pulse' | 'glow'` (efecte vizuale opționale).
- `default_permanent boolean` — dacă la acordare implicit e permanent sau expirabil.

**Tabel nou `user_badge_grants`**:
- `user_id`, `badge_code`, `granted_by`, `granted_at`, `expires_at NULL = permanent`, `reason`, `revoked_at`, `revoked_by`.
- RLS: read own + staff; write DOAR prin RPC `admin_grant_badge` / `admin_revoke_badge`.

**Badge-uri manuale seed-uite** (adăugate în `badge_registry` cu `is_manual=true`):
- `founder_ventuza` — Fondator Ventuza (crown auriu shimmer, permanent)
- `ngo_partner` — Partener ONG (heart verde, permanent)
- `bar_verified` — Local verificat (martini albastru shimmer)
- `event_organizer` — Organizator evenimente (calendar mov)
- `ally` — Aliat comunitate (rainbow pulse)
- `press` — Presă / Media (mic auriu)
- `moderator_public` — Moderator (shield albastru, permanent)
- `beta_tester` — Beta Tester (bug verde)

**RPC** `public.admin_grant_badge(target_user, code, expires_at, reason)` (SECURITY DEFINER, `is_admin_or_above`, audit critical). Update automat `get_user_badges` să includă grant-urile manuale active.

**Panou admin `/admin/users/$id` → tab "Badges"**:
- Listă badge-uri active (auto + manuale) cu sursă vizibilă.
- Formular acordare: select badge manual + toggle "permanent"/data expirare + textarea reason.
- Buton revoke cu confirmare + reason.

**UI vizual** — `BadgeStrip` primește `effect` din registry și aplică:
- `shimmer` → animație CSS `bg-gradient-to-r animate-shimmer`.
- `pulse` → `animate-pulse` (subtil, opacity).
- `glow` → `shadow-[0_0_12px_currentColor]`.
Adaug clase în `styles.css`.

### C. Ordinea execuției

1. Migrare 1 — `user_strikes` + `admin_send_official_message` sistem user + `banned_until` + `legal_hold` + `assigned_moderator_id` + strike RPC-uri + expire trigger.
2. Migrare 2 — extindere `badge_registry` + `user_badge_grants` + `admin_grant_badge` + `admin_revoke_badge` + seed 8 badge-uri manuale + update `get_user_badges`.
3. Server fns noi în `src/lib/admin-user360.functions.ts` (+ `admin-badges.functions.ts` nou).
4. Componente admin: `UserTimelinePanel`, `UserIdentitiesPanel`, `UserStrikesPanel`, `UserFinancialPanel`, `UserBadgesPanel`, `OfficialMessageDialog`, `TemporaryBanDialog`.
5. Extindere `BadgeStrip.tsx` cu efecte + CSS shimmer/glow/pulse în `src/styles.css`.
6. Integrare tab-uri noi în `src/routes/admin.users.$id.tsx`.

### D. Ce NU intră (documentat separat, faza următoare)

- Impersonare view-only (există deja `admin-impersonation.functions.ts` — de audit separat).
- Login map geografic (necesită IP geolocation subprocesor nou — GDPR-blocking, cere update Art. 30 + subprocesatori).
- Merge/split accounts (risc mare, necesită design separat).
- Reverse image search full (necesită subprocesor extern).

## Detalii tehnice

- Toate migrările respectă REGULĂ ADMIN: GRANT-uri, RLS, audit log, MFA guard pe RPC-uri distructive.
- Badge-urile manuale trec prin `assertAdminMfa` + audit `critical`.
- `admin_send_official_message` creează userul sistem `ventuza-support@ventuza.app` cu `age_status='verified'` la prima rulare (idempotent), scrie mesajul direct via `supabaseAdmin` bypassând blocking triggers (justificat: mesaj de sistem, nu comunicare user-to-user).
- `banned_until` este verificat în `assert_account_usable()` deja existent — adaug clause `banned_until IS NULL OR banned_until < now()`.
- Strike decay rulează on-read (funcție `get_active_strikes(user)` filtrează `decay_at > now()`).
