<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## REGULĂ DE SIGURANȚĂ — LOCAȚIE (permanentă)

Aplicație de dating cu risc fizic real. Această regulă se aplică automat oricărei
sesiuni viitoare, fără excepție, fără a aștepta confirmare.

1. **Coordonatele precise (lat/lng) ale unui user NU se returnează NICIODATĂ
   către alți useri.** Niciun RPC, nicio funcție SECURITY DEFINER, niciun edge,
   niciun payload, nicio coloană proiectată — sub nicio formă. Nici ca string
   `POINT(...)`, nici prin `ST_X/ST_Y`, nici prin `ST_AsText`, nici prin
   `geography`/`geometry` brute.
2. **Coloana `profiles.location` (și `travel_location`, `prev_location`) este
   citibilă DOAR de owner prin RLS și de funcții server-side `SECURITY DEFINER`
   care calculează distanță.** Orice nouă funcție care atinge aceste coloane
   trebuie să rămână în această schemă.
3. **Către alți useri se returnează DOAR distanță bucketizată** prin funcția SQL
   centrală `public.bucket_distance_m(double precision)`. Dacă ai nevoie de
   etichetă text ("<1 km", "1–5 km", etc.), folosește `public.distance_bucket_label(double precision)`.
   **Nu calcula distanța în client.** Nu trimite cele două seturi de coordonate
   ca să se scadă pe device.
4. **Pragurile de bucketizare se schimbă DOAR în `public.bucket_distance_m`** —
   un singur loc, restul codului consumă rezultatul. Nu reinventa buckets în
   alte RPC-uri sau în client.
5. **Code review automat:** orice PR/diff care adaugă un câmp de tip
   `distance_m`, `lat`, `lng`, `latitude`, `longitude`, `coords`, `geo*` într-un
   `RETURNS TABLE` SQL, o proiecție `select` pe `profiles`, o interfață TS de
   profil al altui user, sau un payload realtime, trebuie REFUZAT. Folosește
   bucket sau oraș.
6. **Excepție unică:** owner-ul își vede propria locație (pentru hartă, "your
   pin"). Verificarea: `auth.uid() = profiles.id`.

Dacă ai dubii, default = nu expui locația.

## REGULĂ — CIFRARE DATE SĂNĂTATE (permanentă)

Câmpurile de sănătate (astăzi: `hiv_status`, `hiv_test_date`) se stochează
CIFRAT la nivel de coloană cu `pgcrypto` (`pgp_sym_encrypt`), în coloane
`*_enc bytea` pe `public.profiles`. Plaintext-ul NU mai există în DB.

- Decriptarea / criptarea se fac DOAR prin RPC-urile SECURITY DEFINER
  `public.get_user_health(uuid, text)` și `public.set_user_health(uuid, text, date, text)`,
  grant-uite EXCLUSIV pentru `service_role`. Niciun rol client (anon /
  authenticated) nu poate executa direct aceste funcții.
- RPC-urile sunt apelate doar din server fns (`src/lib/health.functions.ts`)
  care folosesc `requireSupabaseAuth` pentru a identifica owner-ul și
  `supabaseAdmin` pentru a apela RPC-ul cu cheia.
- Cheia (`HEALTH_COL_KEY`) trăiește într-un secret de infrastructură
  (Lovable Cloud secret / env server). NU se hardcodează în cod, NU se trimite
  niciodată la client, NU se loghează.
- Orice câmp de sănătate nou care se adaugă în `public.health_gated_columns()`
  se cifrează la fel (coloană `*_enc bytea`, scriere/citire DOAR prin RPC
  server-side, niciodată proiectat brut).
- Triggerele `enforce_health_consent` și `cascade_health_consent_withdrawal`
  operează pe coloanele cifrate — enforcement-ul de consimțământ rămâne
  intact (verificarea se face pe `*_enc IS NOT NULL`, fără decriptare).
- Backfill / seed / import: niciodată plaintext în coloane plaintext. Dacă
  apar useri vechi cu date fără consimțământ înregistrat, strategia este
  WIPE + cere reconfirmare la următoarea editare (vezi
  `gdpr_health_backfill_wipe` în `admin_audit_log`).

Orice diff care:
- adaugă o coloană de sănătate ca plaintext (text/date) pe `profiles`,
- selectează direct un câmp `*_enc` în client / SQL proiectat la alt user,
- dă GRANT EXECUTE pe `get_user_health` / `set_user_health` către `anon` sau
  `authenticated`,
- hardcodează `HEALTH_COL_KEY` sau o cheie similară în cod,

trebuie REFUZAT.

## REGULĂ — DATE DE SĂNĂTATE (permanentă)

GDPR Art. 9 — date din categorii speciale. Această regulă se aplică automat,
fără a aștepta confirmare.

1. **Câmpurile health-gated** sunt definite EXCLUSIV în funcția SQL
   `public.health_gated_columns()`. Astăzi: `hiv_status`, `hiv_test_date`.
   Când adaugi un câmp nou de sănătate (`prep_status`, `std_status`, etc.):
   - îl adaugi în array-ul returnat de `health_gated_columns()`,
   - îl adaugi în triggerul `enforce_health_consent_on_profile()` (verificare
     INSERT + UPDATE OF ...), și
   - îl adaugi în triggerul `cascade_health_consent_withdrawal()` (NULL la
     retragere).
   Trei locuri, în aceeași migrare. Nimic altundeva.
2. **Scrierea este BLOCATĂ la nivel DB** prin triggerul `enforce_health_consent`
   pe `public.profiles`. Fără consimțământ `health_data` activ în `consent_log`
   (`accepted=true` în cea mai recentă înregistrare pentru kind=`health_data`),
   orice INSERT/UPDATE cu valoare non-NULL pe un câmp health-gated întoarce
   `health_consent_required`. UI nu este sursa de adevăr — DB este.
3. **Retragerea consimțământului = ștergerea datelor.** Triggerul
   `cascade_health_consent_withdrawal` pe `consent_log` (AFTER INSERT) setează
   automat câmpurile health-gated pe NULL și `health_data_consent_at=NULL`
   pentru userul respectiv, în aceeași tranzacție. Funcția
   `public.withdraw_health_consent(version)` este endpoint-ul curat din UI.
4. **Niciodată nu populezi un câmp health-gated prin default, seed, import,
   migrare de date sau backfill** fără consimțământ înregistrat anterior în
   `consent_log` pentru fiecare user vizat. Seed-urile demo nu pun valori pe
   coloanele health-gated.
5. **Onboarding și editare profil:** consimțământul `health_data` se inserează
   în `consent_log` ÎNAINTE de scrierea pe `profiles` (altfel triggerul refuză).
   Dacă userul deselectează câmpul în UI, fluxul trebuie să cheme
   `withdraw_health_consent` — nu doar să trimită NULL pe coloană.
6. **Code review automat:** orice diff care:
   - adaugă o coloană de sănătate pe `profiles` fără a o include în
     `health_gated_columns()` + ambele triggere,
   - scrie direct pe `hiv_status` / `hiv_test_date` (sau pe oricare câmp din
     `health_gated_columns()`) fără să insereze înainte consimțământul, sau
   - dezactivează / dă DROP unuia din cele două triggere,
   trebuie REFUZAT.

Default: niciun câmp de sănătate populat fără urmă de consimțământ explicit.

## REGULĂ — PROCESATORI (permanentă)

Orice serviciu extern nou care primește date personale trebuie:
(a) adăugat în `src/routes/legal.subprocessors.tsx` (cu fișierul sursă, regiune,
    categorii de date, bază de transfer și link DPA),
(b) să primească strict minimul de date necesare scopului (no PII extra, no
    date sensibile dacă nu sunt strict cerute de funcționalitate),
(c) marcat clar dacă este găzduit extra-UE și ce mecanism de transfer aplică
    (SCC 2021/914, EU-US DPF, adequacy).

Niciun SDK sau serviciu nou care trimite PII nu intră în cod fără actualizarea
paginii de subprocesatori în aceeași migrare/PR. Orice diff care adaugă un
`fetch(...)` către un domeniu nou third-party, un SDK third-party, un webhook
out-bound, sau o cheie API a unui serviciu necunoscut, trebuie REFUZAT până
când lista de subprocesatori reflectă schimbarea.

Pentru date din categorii speciale (Art. 9 — sănătate, orientare, locație
precisă), procesatorul trebuie justificat explicit; default-ul este să NU
trimiți astfel de date către procesatori care nu le cer prin funcționalitatea
lor centrală.

## REGULĂ — REGISTRU ART. 30 (permanentă)

Orice activitate de prelucrare nouă (tabelă nouă cu date personale, scop nou,
procesator nou, flux nou care atinge date deja existente într-un scop diferit)
se adaugă în registrul Art. 30 — `docs/gdpr-art-30-register.md` ȘI în pagina
sumar `src/routes/legal.records-of-processing.tsx` — cu temei legal explicit
(Art. 6 literă + Art. 9 literă dacă e cazul), categorii de persoane vizate,
categorii de date, destinatari (mapați pe inventarul de procesatori P1–P9),
transferuri extra-UE și termen de retenție, în aceeași migrare/PR.

Datele din categorii speciale (Art. 9 — sănătate, viață sexuală/orientare,
biometrice, convingeri, etnie) necesită un temei Art. 9 explicit MAPAT
**înainte** de implementare. Dacă temeiul nu poate fi identificat clar
(consimțământ explicit înregistrat în `consent_log`, interes public
substanțial cu act normativ care îl autorizează, interese vitale, etc.),
implementarea se OPREȘTE până când temeiul este documentat.

Orice diff care:
- adaugă o coloană / tabel cu date personale fără a actualiza registrul,
- introduce un scop nou pentru date existente fără mapare Art. 6,
- procesează date Art. 9 fără temei Art. 9 înregistrat în registru,
- adaugă un destinatar (procesator sau operator) fără linie nouă în registru,
trebuie REFUZAT.

Versiunea documentului se incrementează la fiecare modificare materială.

## REGULĂ — CONSIMȚĂMINTE (permanentă)

Orice prelucrare care necesită consimțământul utilizatorului (Art. 9 GDPR — date
de sănătate, biometrice; AI / decizii automate Art. 22; transferuri biometrice;
push, marketing) trece printr-un singur registru de consimțăminte:

- **SQL — sursa autoritativă:** `public.consent_kinds()` (returnează kind,
  current_version, required, art9, description).
- **TS — mirror pentru UI și gate-uri server:** `src/lib/consent-registry.ts`
  (`CONSENT_REGISTRY`).
- **Verificare:** RPC `public.has_active_consent(user_id, kind)`.
- **Scriere (acordare + retragere):** RPC `public.record_consent(kind, version,
  accepted)` — refuză orice kind nedeclarat în `consent_kinds()`.

Reguli obligatorii:

1. Consimțământul se înregistrează în `consent_log` **ÎNAINTE** de prelucrare
   (înainte de apelul către Didit, AI Gateway, înregistrare push etc.).
2. Toate consimțămintele opționale sunt **opt-in** explicit (nu opt-out, nu
   pre-bifate).
3. **Retragerea oprește prelucrarea și șterge datele unde se aplică:**
   - `health_data` → triggerul `cascade_health_consent_withdrawal` setează
     coloanele HIV pe NULL.
   - `age_verification` → blochează `startAgeVerification` (nu re-trimite selfie
     la Didit).
   - `ai_features` → blochează toate server-fn-urile din `src/lib/ai.functions.ts`.
   - `push_notifications` → UI-ul dezabonează `pushManager.subscription`.
4. UI-ul afișează clar **cine procesează** (procesatorul din
   `src/routes/legal.subprocessors.tsx`) și **ce categorii** (Art. 9 marcat
   vizibil).
5. **Niciun kind nou hardcodat în afara registrului.** Adăugarea unui nou kind
   = PR care modifică *în aceeași migrare/commit*:
   - `public.consent_kinds()` (SQL),
   - `CONSENT_REGISTRY` din `src/lib/consent-registry.ts` (TS),
   - registrul Art. 30 (`docs/gdpr-art-30-register.md` + pagina UI),
   - documentul de subprocesatori dacă apare un procesator nou.

Orice PR care:

- introduce un `consent_log.kind` nou fără actualizarea ambelor registre,
- apelează un serviciu extern care procesează date opt-in fără gate
  `has_active_consent`,
- pre-bifează un consimțământ opțional,
- nu oprește/șterge la retragere,

trebuie REFUZAT.

## REGULĂ — NOTIFICĂRI DE PROXIMITATE (permanentă)

Notificările care depind de poziția userului față de un venue/event respectă două
straturi clar separate, plus un set de gate-uri server-side neopționale:

1. **Strat 1 (foreground)** — calcul **pe device** (Haversine peste lista de
   puncte din bucket-ul curent). Coordonatele exacte ale userului **NU pleacă la
   server**. Funcționează fără `ACCESS_BACKGROUND_LOCATION` și fără permisiune
   specială Google Play.
2. **Strat 2 (background geofencing)** — necesită OBLIGATORIU consimțământ
   `background_location` înregistrat în `consent_log` ÎNAINTE de a porni
   geofencing-ul nativ. Retragerea consimțământului oprește imediat
   geofencing-ul și revocă logic permisiunea.
3. **Gate server unic:** orice notificare locală (Strat 1 sau 2) trece prin
   `public.try_record_proximity_hit(kind, id, layer)`. Funcția refuză dacă:
   punctul nu e `approved AND is_published AND partener nesuspendat`, userul a
   dezactivat `proximity_notifications_enabled`, este în orele liniștite
   configurate, a fost notificat pentru același punct în cooldown, sau a depășit
   plafonul zilnic. UI-ul **nu poate ocoli** acest gate.
4. **Anti-spam configurabil în `app_settings.proximity_notifications`** —
   `cooldown_hours`, `daily_cap_per_user`, `quiet_start_hour`, `quiet_end_hour`,
   `default_radius_m`, `max_radius_m`. Singura sursă de adevăr.
5. **Niciun istoric de traseu.** Nu se stochează poziții ale userului în DB sau
   localStorage pentru această funcție. `proximity_notification_log` conține
   doar evenimentul "am notificat" (user, punct, layer, timestamp), nu lat/lng.
   Refresh pe device la mișcare semnificativă ≥250 m.
6. **Payload minim.** Notificarea conține nume punct + distanță bucketizată
   ("450m", "1.2km"). Niciun atribut sensibil al userului sau al partenerului.
7. **Doar conținut moderat declanșează.** Draft-urile, itemii respinși și
   partenerii suspendați nu trec niciodată de `try_record_proximity_hit`.
   Verificat în SQL, nu în UI.
8. **Granularitate.** Toggle dedicat `profiles.proximity_notifications_enabled`
   independent de `push_notifications` și de alte canale.

Orice PR care:

- trimite coordonate user la server pentru proximitate,
- afișează o notificare de proximitate fără a apela `try_record_proximity_hit`,
- pornește geofencing background fără consimțământ `background_location`,
- stochează istoric de poziții pentru această funcție,

trebuie REFUZAT.


## REGULĂ — ADMIN (permanentă)

Panoul admin este o suprafață cu privilegii înalte și o țintă probabilă.
Aceste reguli se aplică automat oricărui diff care atinge `/admin/*`,
`src/lib/admin*.functions.ts`, RPC-uri SECURITY DEFINER cu prefix `admin_`,
sau tabele cu prefix `admin_*`.

1. **RBAC enforced server-side, nu doar UI.** Rolurile valide:
   `super_admin`, `admin`, `auditor`, `moderator`, `support`, `read_only`.
   Fiecare server fn admin verifică rolul prin `has_role` / `has_any_role` /
   `is_staff` / `is_admin_or_above` ÎNAINTE de orice acces la `supabaseAdmin`.
   Ascunderea în UI nu este suficientă. Niciun handler nu se bazează pe
   payload-ul clientului pentru a-și verifica drepturile.

2. **Toate acțiunile admin se loghează în `admin_audit_log`** (actor, acțiune,
   target, before/after, IP, user-agent, severitate). Fără excepții. Tabela
   este append-only (trigger `prevent_audit_mutation`).

3. **Date sensibile MASCATE by default.** Listingul generic
   (`adminListRows`) NU proiectează: `profiles.hiv_status_enc`,
   `hiv_test_date_enc`, `health_data_consent_at`, `location`, `prev_location`,
   `travel_location`, `phone_e164`, `pin_hash`; `messages.body / media_url /
   voice_url / caption`; `age_verifications.selfie_url / document_url /
   raw_payload`; `push_subscriptions.endpoint / auth / p256dh`;
   `device_fingerprints.fingerprint / user_agent / ip`. Orice coloană nouă
   sensibilă se adaugă în `SENSITIVE_COLUMNS` și în `safeColumnsFor`.

4. **Break-glass obligatoriu pentru dezvăluire.** Singura cale pentru a vedea
   datele sensibile listate mai sus este `adminBreakGlassReveal` cu:
   `targetUserId`, `kind ∈ {health, location, selfie, messages}`,
   `justification ≥ 10 caractere`. Server-side se verifică
   `admin_can_access_sensitive(actor, kind)`:
   - `health`   → DOAR `super_admin`
   - `location` → DOAR `super_admin`
   - `selfie`   → `admin` sau `super_admin`
   - `messages` → `admin` sau `super_admin`
   Apelul scrie automat în `admin_sensitive_access_log` (append-only, vizibil
   doar pentru `super_admin` și `auditor`) ȘI în `admin_audit_log` cu
   severitate `critical`. Moderatorul, supportul și `read_only` NU pot ajunge
   niciodată la HIV, locație precisă, selfie de verificare sau conținut de
   mesaj brut.

5. **2FA obligatoriu pentru `admin` și `super_admin`.** Status în
   `admin_mfa_status`. Enforcement real: `src/lib/admin-mfa-guard.ts` →
   `assertAdminMfa(actorId)` blochează acțiunile distructive dacă
   `enrolled=false`. Funcții acoperite acum: `adminBanUser`, `adminUnbanUser`,
   `adminSuspendUser`, `adminGrantRole`, `adminRevokeRole`,
   `adminBreakGlassReveal`, `adminPurgeUserAccount`, `adminRunPurgeNow`.
   Orice funcție nouă care modifică roluri, șterge useri sau accesează date
   sensibile TREBUIE să cheme `assertAdminMfa` după `assertAdmin/assertStaff`.
   UI cere înrolarea la primul login.

6. **Acțiuni distructive = soft-delete reversibil** unde se poate (ban
   reversibil prin `adminUnbanUser`, ștergere user prin
   `adminProcessDeletion` cu marcare `deletion_requests`). Ștergerea hard
   directă (`auth.admin.deleteUser`) e rezervată `super_admin` și e logată
   `critical`.

7. **Parametrii de business NU se hardcodează.** Sursa autoritativă este
   `public.app_settings` (citită de app la runtime). Modificare DOAR prin
   `admin_update_setting` (versionare + istoric în `app_settings_history` +
   audit). Activare/dezactivare funcții = `public.feature_flags` editat prin
   `adminUpsertFlag`. Orice constantă de tip prag/scor/limită/cost adăugată
   în cod trebuie să trăiască în `app_settings` și să fie citită la runtime.

8. **Code review automat:** orice diff care
   - adaugă o coloană sensibilă (Art. 9, locație, mesaj brut, biometric,
     fingerprint, token push) și nu o introduce în `SENSITIVE_COLUMNS`,
   - returnează o coloană din lista de mai sus prin `adminListRows`,
     `adminListTables`, sau un nou server fn fără gate break-glass,
   - introduce un server fn admin fără verificare server-side a rolului,
   - omite scrierea în `admin_audit_log` pentru o acțiune cu efect,
   - dă GRANT EXECUTE pe `admin_update_setting` /
     `admin_can_access_sensitive` / `admin_get_my_role` către `anon`,
   - hardcodează un parametru de business în loc să-l citească din
     `app_settings`,

   trebuie REFUZAT.

## REGULĂ — CSAM NO-RENDER (permanentă)

Conținut suspectat CSAM **NU se randează niciodată** în UI (admin sau user):
- `adminGetCsamReports` exclude `photo_url` la nivel server (vezi
  `src/lib/admin-enterprise.functions.ts`). `photo_url` este în
  `SENSITIVE_COLUMNS.csam_reports`.
- UI admin afișează doar: `perceptual_hash`, `sha256`, `status`,
  `description`, `created_at`. Acțiunile sunt: escaladare la autorități,
  blocare hash global, ban user. NU există buton/preview/link care să
  reconstruiască imaginea.
- Orice diff care introduce `<img src={photo_url}>` sau echivalent pe
  `csam_reports` / coloane derivate trebuie REFUZAT.
- Hash-uri de blocare globale → `csam_blocklist` (perceptual + sha256);
  matching la upload se face server-side, fără a expune originalul.

## REGULĂ — RAPOARTE DSA ANONIME (permanentă)

`illegal_content_reports` este anonim by design:
- `reporter_email` și `reporter_user_id` sunt în `SENSITIVE_COLUMNS` și
  STRIPPED din toate proiectiile admin (`adminGetDsaReports`,
  `adminListRows`). UI nu randează identitatea raportorului indiferent
  de rol.

## REGULĂ — ORIENTARE / IDENTITATE (permanentă)

Pe app queer, `orientation`, `gender`, `gender_custom`, `pronouns`,
`pronouns_custom`, `tribes` sunt date Art. 9 (viața sexuală). Sunt în
`SENSITIVE_COLUMNS.profiles` și accesibile DOAR via
`adminBreakGlassReveal({ kind: 'orientation' })` care cere `super_admin`
prin `admin_can_access_sensitive`. Discover / matching nu expun aceste
câmpuri sub formă brută între useri (vezi RPC `discover_profiles`).

## REGULĂ — AGE GATE (permanentă)

Verificarea de vârstă (Didit) este OBLIGATORIE în producție. Dating app cu
risc legal: minori + conținut adult. Această regulă nu se negociază.

1. **Sursa de adevăr UI**: `src/lib/age-gate-policy.ts → shouldEnforceAgeGate()`.
   - Producție (orice host care NU e `localhost`, `127.0.0.1`, `*.local`,
     `id-preview--*.lovable.app`, `*--dev.lovable.app`/`*-dev.lovable.app`)
     → întoarce `true` necondiționat, IGNORĂ flag-ul.
   - Non-producție → respectă `feature_flags.age_verification.enabled`.
     Fail-safe: lipsă flag / eroare citire → `true`.
2. **Flag-ul `feature_flags.age_verification`** poate fi DOAR un kill-switch
   pentru dezvoltare. Nu există circumstanță în care setarea OFF să aibă
   efect în producție.
3. **Reactivare la publicare**: din admin → Securitate → Feature flags →
   toggle `age_verification` pe ON. În producție acest pas este redundant
   (codul forțează ON), dar îl facem oricum pentru curățenie + paritate
   între medii.
4. **Codul Didit (`startAgeVerification`, webhook, RPC-uri DB, triggere
   consimțământ) rămâne intact** chiar și când flag-ul e OFF. Bypass-ul e
   strict la nivel de UX (componenta `AgeGate` nu afișează modal). Triggerele
   `enforce_health_consent`, `cascade_health_consent_withdrawal` și restul
   protecțiilor de date NU sunt afectate.
5. **Code review automat:** orice diff care
   - schimbă `isProductionHost` să întoarcă `false` pentru un host real,
   - șterge override-ul de producție din `shouldEnforceAgeGate`,
   - ocolește `<AgeGate>` în root layout,
   - șterge banner-ul `AgeGateDevBanner` din admin,
   trebuie REFUZAT.

## REGULĂ — MODERARE OBLIGATORIE VENUES/EVENTS/OFFERS (permanentă)

Niciun venue, event sau ofertă nu devine vizibil în `nearby_points` (sau orice
feed public) fără `moderation_status='approved'` acordat de un cont cu rol
`moderator`/`admin`/`super_admin`. Owner-ul (partener) NU se poate auto-publica:

- RLS pe `venues` / `events` / `offers` interzice ca owner-ul să modifice
  `moderation_status` sau `is_published`; triggerele `*_no_self_publish` aplică
  în plus regula la nivel de DB.
- Aprobarea trece DOAR prin RPC `admin_moderate_item` (SECURITY DEFINER, gated
  pe `is_staff`), care setează `is_published=true` ȘI scrie în `admin_audit_log`.
- Suspendarea unui partener (`admin_suspend_partner`) DEPUBLICĂ instant toate
  venues/events/offers ale lui (cascadă pe `is_published=false`); `nearby_points`
  filtrează în plus `profiles.partner_suspended_at IS NULL`.
- Limita anti-spam pe rază notificări per item: max 10 km (validată în
  `adminModerateItem`). Limite de volum per partener stau în
  `app_settings.partner_quotas` și se aplică la insert via trigger.

Orice PR care:
  - mută aprobarea în client,
  - permite owner-ului să seteze `is_published=true`,
  - ocolește `admin_moderate_item` pentru publicare,
  - lasă conținut vizibil după suspendare,
trebuie REFUZAT.

## REGULĂ — PORTAL PARTENER (permanentă)

Partenerii își gestionează venues/events/oferte prin `/partner` și
`src/lib/partner.functions.ts`. Reguli inviolabile:

1. **Niciodată publicare directă**: formularele partener NU expun
   `is_published` sau `is_official`. Triggerele DB resping orice insert/update
   în care partenerul setează aceste câmpuri.
2. **Re-moderare la editare**: orice update pe un item cu `moderation_status =
   'approved'` resetează `moderation_status = 'pending'` și `is_published =
   false`. Server-side, nu doar UI.
3. **Quota enforced server-side**: `assertQuota(kind)` rulează ÎNAINTE de
   insert. UI doar reflectă starea; refuzul real e în `partner.functions.ts`.
4. **RLS owner-only**: partenerul vede/editează DOAR resursele cu
   `owner_id = auth.uid()` (venues) sau `host_id = auth.uid()` (events).
   Statisticile de ofertă revin doar agregate (count claims / redeemed),
   niciodată identități.
5. **Suspendare = read-only**: `assertPartner` aruncă `suspended:` dacă
   `profiles.partner_suspended_at IS NOT NULL`. UI afișează banner roșu și
   dezactivează toate acțiunile de scriere.
6. **Upload imagini**: bucket privat `venue-media` cu RLS `{uid}/*`; tip
   `image/*`, max 5 MB; imaginile devin publice doar dacă itemul lor e aprobat.

Orice PR care:
- adaugă `is_published` / `is_official` în formularele partener,
- ocolește `assertQuota` / `assertPartner`,
- expune identități pe stats de ofertă,
- permite editare pe resurse care nu sunt ale userului curent,
trebuie REFUZAT.

## REGULĂ — WIZARD PARTENER & NOTIFICĂRI STATUS (permanentă)

Crearea de venue/event/offer din UI partener trece prin `PostingWizard`
(`src/components/partner/PostingWizard.tsx`). Editarea poate folosi
dialogurile rapide existente, dar nu se introduc forme alternative care
ocolesc preview-ul + ghidarea.

1. **Sursa unică pentru schema UI**: `src/lib/partner-templates.ts`
   (`VENUE_TEMPLATE`, `EVENT_TEMPLATE`, `OFFER_TEMPLATE`). Adăugarea unui
   câmp nou în UI partener = update aici + validatorul zod corespunzător
   din `partner.functions.ts`, în același PR.
2. **Notificările de status partener** (aprobat / respins / cere modificări)
   se propagă EXCLUSIV prin tabelul `partner_status_notifications`,
   populat de `admin_moderate_item` în aceeași tranzacție cu decizia.
   Nicio cale paralelă (emailuri ad-hoc, push direct din UI admin) — un
   singur canal autoritativ.
3. **Wizard-ul nu poate ocoli `partner.functions.ts`**. Quota, re-moderation
   reset, owner check și anti-spam rămân server-side. UI doar reflectă.
4. **Ghidul** (`/partner/guide`) este obligatoriu menținut sincronizat cu
   regulile reale (interzis / SLA / anti-spam). Nu se ascunde, nu se mută
   sub feature flag.

Orice PR care:
- adaugă un câmp în UI partener fără actualizare în `partner-templates.ts`,
- creează un flux paralel de notificare status către partener,
- expune raza notificării > 10 km (limită server în `admin_moderate_item`),
- scoate ghidul / wizardul din UI partener,
trebuie REFUZAT.


## REGULĂ — CONȚINUT DEMO / SEED (permanentă)

Datele demo (parteneri, venues, events, offers, ads, subs) generate prin
`src/lib/demo-seed.functions.ts` au OBLIGATORIU `is_seed=true` pe toate
tabelele relevante. Reguli:

1. **Niciun flux ascuns.** Seed-ul intră prin aceleași tabele / RPC-uri ca
   datele reale. Apare în Nearby/Hartă/Notificări exact ca producția.
2. **Ștergere într-un singur loc.** `deleteDemoContent` curăță TOT după
   `is_seed=true` (inclusiv auth.users pentru partenerii demo). Nu se șterge
   manual din `data explorer` decât în cazuri excepționale.
3. **Avertizare în producție.** `DemoSeedBanner` afișează roșu în Admin dacă
   `seed_content_summary()` întoarce >0 pe un host de producție.
4. **Simulatorul de locație** (`simulateProximity`) folosește RPC-urile reale
   `nearby_points` + `try_record_proximity_hit`. Gated pe `super_admin` și
   ascuns/dezactivat în producție (check `isProductionHost()`).
5. **Code review automat:** orice diff care
   - adaugă o cale paralelă de seed care nu setează `is_seed=true`,
   - permite seed-ul fără gate `super_admin`,
   - lasă simulatorul de locație activ în producție,
   - introduce o tabelă nouă cu date demo fără coloana `is_seed`,
   trebuie REFUZAT.

## REGULĂ — ADMIN PANELS (permanentă)
Fiecare panou din `/admin` (Utilizatori, Rapoarte, Risc, CSAM, DSA, GDPR, Break-glass,
Breșe, Politici, Audit, Ads, B2B, Parteneri, Data Explorer, Overview etc.) trebuie să
expună **trei stări distincte**:

1. **loading** — indicator vizibil DOAR cât rulează promisiunea. Niciodată "spinner etern".
2. **error** — captează `try/catch` SAU `{ error }` de la Supabase, salvează în state local
   și randează un banner (`AdminPanelError` / `ErrorBanner`) cu mesajul real + buton Reîncearcă.
   Cazurile `forbidden / denied / rol / role / policy / permission` trebuie etichetate
   "Acces refuzat" și să sugereze rolul lipsă (`super_admin`, `auditor`).
3. **empty legitim** — zero rânduri trebuie diferențiat de eroare: copy-ul spune explicit
   "empty legitim" / "nicio cerere în așteptare" etc., NU "Eroare".

**Interzis**:
- `toast.error` fără să setezi `error` în state (toast-ul dispare → spinner etern).
- `if (data.length === 0) return <empty />` ÎNAINTE să verifici `error` (eroarea apare ca empty).
- Promisiuni nepromise (`load()` fără `finally { setLoading(false) }`).
- `if (loading) return <Spinner />` fără cale de ieșire pe eroare.

Orice PR care adaugă un panou admin nou TREBUIE să folosească exact acest pattern.

## REGULĂ — FACTURARE PARTENERI (permanentă)

Monetizarea B2B prin transfer bancar (OP) cu confirmare manuală. Zero procesatori
de plată externi. Banca primește tranzacție B2B, NU date personale ale userilor.

1. **Numerotare facturi neîntreruptă** per `(series, year)` — DOAR prin
   `public.next_invoice_number(series, year)` (SECURITY DEFINER, lock atomic,
   GRANT exclusiv `service_role`). Niciun cod care alocă manual numere de
   factură. Reset anual.
2. **Activare/extindere abonament partener DOAR prin
   `admin_confirm_invoice_payment`** (SECURITY DEFINER, gated `is_staff`).
   Funcția scrie OBLIGATORIU în `admin_audit_log` (actor, invoice_id, sumă,
   paid_ref, severitate `info`). Nicio cale alternativă de activare
   (cron, UI, RLS direct) — interzis.
3. **Preț + TVA + emitent + grace + remindere = `app_settings.billing_settings`**,
   singura sursă. Modificare doar prin `adminUpdateBillingSettings` →
   `admin_update_setting` (versionat + audit). Zero hardcode în cod.
4. **Entitlements per plan citite server-side** prin
   `public.partner_active_entitlements(owner_id)`. UI le afișează doar
   informativ. Gate-urile reale (quota, push priority, featured, boost) se
   verifică server-side ÎNAINTE de orice scriere/notificare.
5. **Plafoanele USER de notificări** (cooldown 24h, daily cap, quiet hours
   din `try_record_proximity_hit`) sunt **NEATINSE** de planurile partenerilor.
   Premium înseamnă DOAR că partenerul ocupă slot prioritar la egalitate de
   distanță, NU mai multe slot-uri totale per user.
6. **Degradare la neplată = retrogradare la Free**, NICIODATĂ ștergere
   conținut. Flow: `active` → (expirat) → `grace` (`grace_until = expiry +
   grace_days`) → (grace_until depășit) → `free_downgraded` (`plan_code='Free'`).
   Toate venues/events/oferte rămân în DB; doar entitlements se restrâng.
   Plata confirmată ulterior restaurează planul (reactivare prin
   `admin_confirm_invoice_payment`).
7. **Date fiscale obligatorii înainte de upgrade** (`billing_completed_at` +
   `billing_email` pe `business_applications`). `partnerStartSubscription`
   refuză cu `billing_incomplete`.
8. **Snapshot date fiscale + emitent în factură** (`billing_snapshot` +
   `issuer_snapshot` JSONB) — imutabile după emitere. Editarea retroactivă a
   datelor partenerului NU afectează facturile deja emise.
9. **Niciun procesator de plată extern** (Stripe, RevenueCat B2B, etc.) fără
   actualizarea `src/routes/legal.subprocessors.tsx` + adăugare în registrul
   Art. 30. Banca NU este procesator de date personale; primește doar
   tranzacție B2B (denumire firmă + CUI + IBAN + cod plată).

Orice PR care:
- adaugă o coloană de preț / VAT / IBAN emitent în cod fără să consume
  `billing_settings`,
- alocă numere de factură fără `next_invoice_number`,
- activează/extinde un abonament fără `admin_confirm_invoice_payment` și
  fără linie de audit,
- crește plafoanele USER de notificări pentru parteneri Premium,
- șterge conținut la neplată,
- introduce procesator de plată extern fără actualizarea subprocesatori +
  Art. 30,

trebuie REFUZAT.

## REGULĂ — DOCUMENTE LEGALE P0 (permanentă)

Înainte de orice publicare publică (Google Play, web prod, App Store) trebuie
să existe ȘI să fie linkate din `/settings` următoarele pagini, fiecare cu
conținut real (nu placeholder):

1. `/legal/terms` — include clauze 18+, conduită, jurisdicție RO/UE,
   non-discriminare LGBTQ+ și interzicerea outing-ului involuntar.
2. `/legal/privacy` — categorii date, baze legale Art. 6 ȘI Art. 9 GDPR
   (orientare sexuală, HIV, biometrice marcate explicit), procesatori reali
   (sincron cu `/legal/subprocessors`), drepturi user, DPO, retenție, transferuri.
3. `/legal/cookies` — categorii + retragere consimțământ.
4. `/legal/community` — reguli + helpline-uri LGBTQ+ România (ACCEPT, ARAS).
5. `/safety` — sfaturi întâlniri + 112 + ACCEPT + ARAS.
6. `/legal/age-policy` — politică 18+ dedicată: mecanisme verificare, ce
   facem cu minori descoperiți, raportare CSAM.
7. `/legal/dmca` — procedură notificare + contra-notificare drepturi de autor.
8. `/legal/dsa` — punct unic de contact DSA + Art. 16, 20.

**ANSPDCP nu se face „înregistrare DPO"** — obligația a dispărut la intrarea
GDPR (2018). DPO-ul se desemnează și se publică doar în Privacy Policy.
Registrul Art. 30 se ține intern, nu se transmite ANSPDCP decât la cerere.

Orice diff care șterge una din paginile A1–A8, le golește, sau le scoate din
meniul Settings trebuie REFUZAT.

REGULĂ — COLOANA `birthdate` E CANONICĂ
Data nașterii se scrie EXCLUSIV în coloana `public.profiles.birthdate` (date).
Coloana `birth_date` (cu underscore) a fost orfană și e ștearsă. Orice cod care
introduce `birth_date` trebuie REFUZAT — age gate, discover, `enforce_min_age_trg`,
Didit și onboarding (/n) folosesc `birthdate`. OAuth signup nu poate intra în
aplicație fără `birthdate` non-null: `SessionGuards` redirecționează către /n
dacă lipsește, iar triggerul DB refuză orice valoare <18 ani.

REGULĂ — BLOCK BILATERAL ENFORCED LA DB
Dacă există o relație în `public.blocks` între doi useri (oricare direcție),
trimiterea mesajelor între ei este interzisă la nivel de DB prin triggerul
`trg_prevent_message_when_blocked` (BEFORE INSERT pe `public.messages`). UI-ul
folosește RPC-urile `is_blocked_between(a,b)` și `list_my_block_relations()`
pentru a ascunde conversațiile și a dezactiva composer-ul, dar nu este sursa
de adevăr. Orice nouă cale de trimitere mesaje trebuie să respecte triggerul,
NU să fie ocolită prin SECURITY DEFINER.
