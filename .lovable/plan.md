# Audit de securitate Ventuza — raport verificat + plan remediere

Verificat direct în DB (`discover_profiles`, policies pe `offers`/`illegal_content_reports`/`sos_events`, GRANT-uri pe RPC-uri admin, `get_user_health`/`set_user_health`). Raportul anterior din `.lovable/plan.md` a fost reconfirmat cu o corecție: `discover_profiles` NU returnează `hiv_status` plaintext (sub-agentul a halucinat acel finding — RETURNS TABLE conține doar `birthdate`, `distance_m` bucketizat, `last_seen`, restul publice).

## 🔴 CRITIC

**Niciunul confirmat ca scurgere Art. 9.** Datele HIV sunt corect izolate (RPC-urile `get_user_health`/`set_user_health` au GRANT exclusiv pentru `service_role`, coloanele `*_enc` nu apar în nicio proiecție către alți useri). Locația precisă nu pleacă de pe device în `discover_profiles` (doar `bucket_distance_m`). RLS bilateral block este enforced la DB via trigger. Escaladare de rol blocată prin `prevent_profile_privilege_escalation` și `user_roles` RLS strict.

## 🟠 MEDIU (toate verificate, exploatabile)

**M1. Age gate ocolibil prin RPC** — `discover_profiles` verifică doar `_viewer = auth.uid()`, NU `me.age_status = 'verified'`. Un user logat cu cont fără Didit poate apela RPC-ul din DevTools/Postman și primește feed-ul complet de profile adulte (incl. poze, vârstă, distanță). AgeGate.tsx este strict UI. Risc legal (minori + conținut adult), nu scurgere Art. 9. Aceeași observație pentru `get_or_create_conversation`, `set_looking_now`.
Fișier: ultima migrare `discover_profiles`, liniile 9–10.

**M2. `offers` permite owner-ului auto-publicare** — policy „Venue owner manages offers" FOR ALL TO authenticated cu `WITH CHECK (venue.owner_id = auth.uid())` — fără restricția `is_published = false` pe care o au `venues` și `events`. Partener poate publica direct ofertă fără moderare → bypass regulă moderare obligatorie.

**M3. `illegal_content_reports` INSERT anon nelimitat** — policy „Anyone files dsa report" cu `polroles={-}` (PUBLIC) și `WITH CHECK (true)`. Niciun rate-limit DB. Atacator anonim poate inunda coada DSA → admin orb.

**M4. SECURITY DEFINER admin_* cu GRANT EXECUTE pentru `anon`** — confirmat în `pg_proc.proacl` pentru `admin_update_setting`, `admin_confirm_invoice_payment`, `admin_moderate_item`, `admin_get_my_role`, `admin_can_access_sensitive`, `admin_analytics_summary`. Toate verifică intern rolul prin `has_role`/`is_staff`, deci azi NU sunt exploatabile, dar suprafața de atac e nejustificat de largă: orice refactor care scoate check-ul intern devine RCE-from-anon.

**M5. `app_settings` SELECT public la `anon`** — expune `billing_settings` (CUI, IBAN, telefon `+40753326405`, email `business@`, adresă fizică), `rate_limits.*` (praguri anti-spam), `proximity_notifications` (quiet hours, cooldown, daily cap, radius). Atacator: harvest contact + evaziune anti-spam fără login.

**M6. `sos_events` stochează `latitude`/`longitude` exacte** (nu bucketizat). Tabel citit de `admin`/`moderator` prin policy „mods read all sos". Breach = locație precisă într-un moment de criză (date sensibile contextual). Recomandare: păstrare exactă DOAR pentru durata răspunsului (24h), apoi rotunjit/șters.

**M7. `discover_profiles` returnează `birthdate` exact** (nu doar `age::int` derivat) atunci când `hide_age=false`. Cititor RPC vede data nașterii precisă a altor useri, deși UI afișează doar vârsta. Minor, dar inutil → derivat suficient.

## 🟡 MINOR

- **m1.** `prevent_profile_privilege_escalation` nu acoperă `incognito` — un cont sancționat poate seta `incognito=true` direct și dispare din moderare/discover.
- **m2.** OAuth birthdate stocat în `localStorage` ca `vz_pending_birthdate` (`src/routes/auth.tsx:38-49`). XSS minor sau extensie poate suprascrie înainte de callback. Triggerul `enforce_min_age` validează doar >18, nu autenticitatea.
- **m3.** `rate_limit_log` are RLS ON dar 0 policies — funcțional locked, dar fragil dacă mută cineva scrierea în client.
- **m4.** `consent_log`/`csam_reports` citibile de staff fără logare „break-glass" per citire (există doar pentru HIV/location/messages/selfie).
- **m5.** `submitBusinessApplication` și `lookupAnafCui` server-fn fără rate-limit/captcha → abuz ANAF, spam aplicații parteneri.
- **m6.** `AgeGate` cu `enforce` inițial `false` (chiar dacă `shouldEnforceAgeGate` setează `true` imediat în prod prin `isProductionHost`) — fereastră scurtă de flash pe react-render înainte ca effect-ul async să termine; UI-only, RPC-ul nu e protejat oricum (vezi M1).

## ✅ CONFIRMAT SECUR

- **Locație**: `profiles.location` SELECT RLS owner-only; `discover_profiles` proiectează doar `bucket_distance_m`; `get_or_create_conversation`/`set_looking_now` nu returnează coordonate. Coordonate exacte NU pleacă în payload între useri.
- **HIV / Art. 9**: `hiv_status_enc`/`hiv_test_date_enc` doar bytea; `get_user_health`/`set_user_health` GRANT EXCLUSIV `service_role` (confirmat în `proacl`); triggere `enforce_health_consent` + `cascade_health_consent_withdrawal` funcționale; nicio proiecție în `discover_profiles`.
- **Block bilateral**: enforced la DB prin `trg_prevent_message_when_blocked` (BEFORE INSERT pe `messages`) + filtrare în `discover_profiles` (NOT EXISTS pe `blocks`).
- **Escaladare rol**: `prevent_profile_privilege_escalation` resetează 32 câmpuri sensibile; `user_roles` RLS scoped pe `has_role('admin')`; admin server-fn-urile au `assertAdmin`/`assertStaff` + `assertAdminMfa` pe acțiuni distructive.
- **Venues/events moderare**: trigger `*_no_self_publish` și WITH CHECK pe RLS împiedică owner-ul (cu excepția `offers` — vezi M2).
- **CSAM**: `photo_url` strippat în `adminGetCsamReports` (în `SENSITIVE_COLUMNS`), no-render în UI.
- **Storage**: toate bucketele private, scoped `{uid}/...`.
- **Audit append-only**: `admin_audit_log` cu trigger `prevent_audit_mutation`.
- **Webhooks publice** (`api/public/google-play-rtdn`, `age-webhook`): semnătură verificată; `billing-tick` doar cron, fără input user.
- **Auth**: signup email cu confirmare; OAuth cu `SessionGuards` care forțează `/n` dacă `birthdate IS NULL`; trigger DB refuză <18.

---

## Plan remediere (la aprobare → build mode)

### Migrare SQL unică

```sql
-- M1: gate age_status în RPC-urile sensibile
-- adăugare la începutul discover_profiles / get_or_create_conversation / set_looking_now:
--   IF NOT EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND age_status='verified')
--   THEN RAISE EXCEPTION 'age_verification_required' USING ERRCODE='42501'

-- M2: offers WITH CHECK (is_published=false AND moderation_status='pending') pentru owner
DROP POLICY "Venue owner manages offers" ON public.offers;
CREATE POLICY ... cu restricție is_published=false + trigger offers_no_self_publish

-- M3: illegal_content_reports → TO authenticated (sau menținut public DAR cu trigger rate_limit pe IP)
DROP POLICY "Anyone files dsa report"; recreate TO authenticated

-- M4: REVOKE EXECUTE ON FUNCTION admin_* FROM anon, PUBLIC;
--     GRANT EXECUTE ON FUNCTION admin_* TO authenticated;

-- M5: app_settings SELECT split — billing_settings + rate_limits → policy is_staff only
--     Restul (proximity_notifications.default_radius_m, etc.) rămân public minim

-- M6: sos_events — opțiune A: trigger care setează lat/lng pe NULL după 24h
--     opțiune B: bucketizare imediată + păstrare exactă într-o coloană restrânsă la
--     emergency_contact_user_id (consent explicit)

-- M7: discover_profiles RETURNS TABLE → înlocuiește `birthdate date` cu `age int` derivat;
--     menține `hide_age` flag pentru a întoarce NULL.

-- m1: extinde prevent_profile_privilege_escalation cu 'incognito'
--     (acceptat doar dacă userul NU e suspendat/ban; altfel resetat)

-- m3: policy explicită pentru rate_limit_log (service_role insert + staff read)
```

### Cod frontend

- **m2 (OAuth birthdate)**: după callback, dacă `profiles.birthdate IS NULL`, forțează re-prompt UI care apelează `confirmPendingBirthdate({birthdate})` server-fn (validează prin trigger DB). Elimină dependența de `localStorage` ca singură sursă.
- **m5 (rate-limit)**: `submitBusinessApplication` + `lookupAnafCui` → `try_rate_limit(kind, key)` server-side (există deja tabela `rate_limit_log`).
- **m6 (AgeGate flash)**: state inițial `enforce=true` (fail-closed) până rezolvă `shouldEnforceAgeGate`.

### Verificare post-fix

- `supabase--linter` clean.
- Test manual: cont nou fără Didit → `supabase.rpc('discover_profiles', {...})` din DevTools trebuie să întoarcă `42501 age_verification_required`.
- Test: `discover_profiles` payload nu mai conține `birthdate` (doar `age`).
- Test: owner partener încearcă `update offers set is_published=true` → refuzat de policy + trigger.

### Update AGENTS.md

- Regulă nouă „RPC GATE": orice SECURITY DEFINER care returnează date de profil ale altor useri TREBUIE să verifice `age_status='verified'` și să NU proiecteze `birthdate` exact / `*_enc` / `distance_m` raw / `location` raw.

Aprobă pentru a trece în build mode.