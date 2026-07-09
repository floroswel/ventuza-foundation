## Raport de diagnostic — audit complet aplicație

Nu am modificat nimic. Mai jos, doar ce am găsit efectiv (verificat în cod + DB + linter), pe categorii, cu severitate.

---

### 0. Verificări globale
- `tsgo --noEmit` → **0 erori** TypeScript.
- Console logs preview → **0 erori** runtime la momentul auditului.
- Security scan Lovable → 3 findings (analizate mai jos).
- Supabase linter → 224 issues, majoritatea `search_path` mutable (WARN, cosmetic) + item-ul central de mai jos.

---

### 1. SECURITY DEFINER expus la `anon` — identificat complet (BLOCKER de rezolvat)

Linter-ul flagează 48 funcții SECURITY DEFINER cu `EXECUTE` acordat rolului `anon`. Lista completă (schema `public`):

**Admin (nu trebuie NICIODATĂ anon):** `admin_apply_strike`, `admin_assign_alert`, `admin_assign_moderator`, `admin_grant_badge`, `admin_reveal_profile_location`, `admin_revoke_badge`, `admin_send_official_message`, `admin_set_legal_hold`, `admin_set_temporary_ban`.

**Didit / vârstă:** `didit_apply_result`, `didit_link_session`, `sync_age_status_from_verification`, `reset_stale_age_verification`, `reset_stale_age_verifications_batch`.

**Verificare internă:** `assert_verification_or_limited`, `is_verification_staff`, `verification_decide_invariants_snapshot`, `verification_generate_challenges`, `verification_list_purgeable_paths`, `verification_mark_purged`, `verification_moderator_claim`, `verification_moderator_decide`, `verification_moderator_take`, `verification_submit_request`.

**Consent / user:** `record_consent`, `get_active_strikes`, `get_user_badges`, `get_user_badges_batch`, `get_venue_badges`, `get_venue_badges_batch`, `get_country_risk`, `get_message_location_bucket`, `is_profile_publicly_visible`, `safe_message_row`, `send_location_message`, `update_live_location_message`.

**Email queue interne (pgmq wrappers):** `enqueue_email`, `delete_email`, `read_email_batch`, `email_queue_dispatch`, `email_queue_wake`, `move_to_dlq`.

**Diverse:** `app_role_values`, `security_invariants_snapshot`, `sync_partner_announcements_consent`, `tg_notify_new_like`, `st_estimatedextent` (×3, PostGIS — ignorabil).

**Severitate: BLOCKER** pentru `admin_*` (privilege escalation dacă exploatabile — deși au verificări interne pe rol, EXECUTE la anon rămâne risk). **MAJOR** pentru restul (surface expus inutil). PostGIS `st_estimatedextent` — minor/ignore.

**Cauză probabilă:** `GRANT EXECUTE ... TO PUBLIC` default sau migrări vechi fără `REVOKE ... FROM PUBLIC, anon`.

---

### 2. RLS Disabled in Public
- `public.spatial_ref_sys` — tabelă sistem PostGIS, **nu se poate atinge** (owner = extension). **Ignore** (fals pozitiv standard).

---

### 3. Autentificare (email/password, Google OAuth)
Verificat: `src/routes/auth.tsx` (743 linii), `src/lib/auth-context.tsx`, `src/integrations/lovable/index.ts`, `src/integrations/supabase/auth-*.ts`.
- Flux OAuth trece prin `lovable.auth.signInWithOAuth` (corect).
- Bearer attacher + middleware `requireSupabaseAuth` prezente, wiring OK.
- **Minor:** `useAuth` folosește `getSession()` pentru hydratare — acceptabil pentru bearer attachment; nu-i regresie.
- Nu am găsit redirect_uri protejat sau alte anti-pattern-uri OAuth în `auth.tsx`.

**Nu am reprodus buguri autentificare la momentul auditului.**

---

### 4. Onboarding (`/n`, 927 linii) + Profile
- Nu am găsit erori TS sau runtime la audit.
- **Notă (nu bug nou, deja regulă în memory):** `birthdate` este canonic; verificat că `SessionGuards` redirect → `/n` dacă lipsește.

---

### 5. Ecrane principale
- Nu am rulat Playwright pe fiecare rută în această tură (ai cerut audit rapid). Nu există erori de import (`tsgo` clean) și `routeTree.gen.ts` corespunde fișierelor prezente.
- **Recomandare:** dacă vrei crawl vizual full (screenshots pe fiecare rută publică), pot rula într-o tură dedicată.

---

### 6. Push notifications (FCM / Web Push)
- `src/lib/web-push.server.ts` — cheie privată OBLIGATORIE prin env, fail-safe corect (nu are fallback în cod).
- `public/push-sw.js` prezent, `web-push-config.ts` OK cu fallback pentru cheia publică.
- **Minor:** fallback cheie publică hardcodat în `web-push-config.ts` — dacă rotești cheia și uiți să setezi `VITE_VAPID_PUBLIC_KEY`, subscriberii noi merg pe cheia veche; funcțional, dar aducem eșec silențios.

---

### 7. Mobile / Capacitor
- `capacitor.config.ts` există; `CookieBanner` deja detectează `Capacitor.isNativePlatform()` (memoria confirmă).
- **Neverificat automat:** safe-areas pe device fizic. Cere test manual.

---

### 8. GDPR / Consimțăminte
- Registrul `consent_kinds()` + `CONSENT_REGISTRY` mirror-uite corect (verificat că `internal_verification` retras conform regulii).
- Triggerele health (`enforce_health_consent`, `cascade_health_consent_withdrawal`) — verificate anterior, active.
- **Nu am găsit regresie.**

---

### 9. Realtime profiles + venues.phone_e164
- **Fail-closed, intenționat.** Nu sunt bug-uri (marcate WARN în scan, dar corecte).

---

### 10. Regresii recente
- Fix-urile din turele anterioare (admin-overview columns, SessionGuards sharingEnabled, ImageBubble useState) — toate persistă în cod, nu regresat.
- **Nu am identificat regresii noi introduse.**

---

### Rezumat pe severitate

| Severitate | Nr. | Item |
|---|---|---|
| **BLOCKER** | 9 | `admin_*` SECURITY DEFINER cu EXECUTE la anon |
| **MAJOR**   | ~36 | Restul funcțiilor SECURITY DEFINER cu EXECUTE la anon (didit, verification, consent, email queue etc.) |
| **MINOR**   | 2 | VAPID fallback hardcodat; PostGIS `st_estimatedextent` la anon |
| **FALS POZ.** | 3 | `spatial_ref_sys`, realtime profiles, venues.phone_e164 |

---

### Ce recomand în următoarea tură (când zici tu)

1. **Fix #1 (blocker):** o migrare `REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC, anon;` pentru toate funcțiile din listă, cu re-GRANT explicit la `authenticated` sau `service_role` după caz (fiecare funcție analizată individual — unele trebuie strict `service_role`, ex. `didit_apply_result`, `admin_*`; altele `authenticated`, ex. `record_consent`, `get_user_badges`).
2. **Fix #2 (minor):** scoate fallback-ul VAPID hardcodat din `web-push-config.ts` și eșuează explicit dacă env-ul lipsește (paralel cu server-side).
3. **Opțional:** crawl Playwright pe rutele publice pentru screenshot audit.

Confirmă și aplic în ordinea de mai sus.
