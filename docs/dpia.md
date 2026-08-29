# DPIA — Suzeta (Data Protection Impact Assessment)

**Status:** DRAFT — necesită validare de consultant GDPR extern înainte de publicare.
**Versiune:** 1.0.0
**Data:** 2026-07-13
**Operator:** VOMIX GENIUS S.R.L., CUI 43025661, România
**DPO:** dpo@suzeta.ro
**Bază legală DPIA:** GDPR Art. 35 (prelucrare la scară largă de date Art. 9 —
orientare sexuală + date sănătate opționale).

---

## 1. Descrierea sistematică a prelucrării

### 1.1 Natura prelucrării

Suzeta este o aplicație de dating pentru comunitatea LGBTQ+, disponibilă pe web
(PWA) și Android nativ (Capacitor). Fluxul principal:

1. Utilizator adult (18+) se înregistrează cu email + parolă sau Google OAuth.
2. Verifică vârsta prin selfie live procesat de Didit (procesator UE, imaginea
   se șterge imediat după verdict).
3. Completează profil: pronume, orientare, tribes, foto, prompt-uri.
4. Vizualizează profiluri din apropiere (distanță bucketizată, coordonate
   precise NU se transmit între useri).
5. Trimite/primește mesaje 1:1 (text, foto, voce).
6. Opțional: publică status HIV cu consimțământ explicit (cifrat la coloană).

### 1.2 Scopurile prelucrării

- **Facilitarea întâlnirilor între adulți consimțitori LGBTQ+** (scop principal).
- **Verificarea vârstei** (obligație legală + protecția minorilor).
- **Moderarea conținutului ilegal** (DSA — Digital Services Act).
- **Prevenirea fraudei** (device fingerprint, country risk).
- **Comunicare tranzacțională** (confirmare cont, notificări).

### 1.3 Categoriile de persoane vizate

Utilizatori adulți (18+) auto-declarați LGBTQ+ sau aliați, majoritatea din
România și diaspora RO din UE.

### 1.4 Categoriile de date

| Categorie | Exemple | Bază Art. 6 | Bază Art. 9 |
|-----------|---------|-------------|-------------|
| Identificare | Nume afișat, email, UUID | 6(1)(b) contract | — |
| Localizare precisă | GPS, oraș | 6(1)(a) consimțământ | — |
| Fotografii | Profil, chat, verificare | 6(1)(b) + 6(1)(a) | — |
| **Orientare sexuală** | orientation, tribes, gender | — | **9(2)(a) consimțământ explicit** |
| **Date sănătate** | HIV status (opțional) | — | **9(2)(a) consimțământ explicit + cifrare la coloană** |
| Comunicații | Mesaje 1:1 | 6(1)(b) contract | — |
| Fingerprint device | Hash IP + UA | 6(1)(f) interes legitim (anti-fraudă) | — |
| Comportament | Swipes, matches, taps | 6(1)(b) | — |

### 1.5 Destinatari (subprocesatori)

Vezi lista completă în `/legal/subprocessors` și `docs/gdpr-art-30-register.md`.
Rezumat: Supabase (EU/Frankfurt — DB principal), Didit (verificare vârstă),
Firebase Cloud Messaging (push), RevenueCat (schelet B2B), Resend (email),
Cloudflare (CDN + Turnstile), ANAF (obligații fiscale RO).

---

## 2. Evaluarea necesității și proporționalității

### 2.1 Necesitate

Fiecare categorie de date are utilitate directă:
- **Orientare / tribes** → matching relevant (fără = experiența e generică,
  eșuează scopul aplicației).
- **Locație precisă** → doar pentru bucketizarea distanței între useri
  (coordonatele nu părăsesc niciodată server-ul spre alți useri).
- **HIV status opțional** → harm reduction, alegere explicită a userului.
- **Selfie Didit** → obligație legală de a preveni accesul minorilor la app
  cu conținut 18+.

### 2.2 Proporționalitate

Minimizare aplicată:
- Coordonatele precise se convertesc SERVER-SIDE în bucket de distanță
  (`bucket_distance_m`). Nu se transmit între useri sub nicio formă.
- Selfie Didit este tranzitoriu — Didit nu-l stochează după verdict.
- HIV status e opt-in (default: nu se colectează). La retragere consimțământ,
  se șterge automat (trigger `cascade_health_consent_withdrawal`).
- Mesajele nu se scanează cu AI decât pentru moderare CSAM (hash perceptual,
  fără LLM peste conținut).
- Fingerprint device: hash IP + UA, nu tracking cross-app.

Alternative respinse:
- **Fără verificare vârstă** → risc penal (acces minori la platform 18+).
  Compromis: verificare biometrică live tranzitorie (Didit), NU document ID.
- **Location share cu alți useri** → risc fizic (stalking, outing). Compromis:
  bucketizare server-side.
- **HIV disclosure obligatoriu** → discriminare. Compromis: opt-in explicit +
  cifrare + retragere.

---

## 3. Riscurile pentru drepturile și libertățile persoanelor vizate

### 3.1 Outing involuntar (RISC ÎNALT)

**Amenințare:** un membru al familiei / angajator accesează device-ul userului
și descoperă orientarea.
**Impact:** discriminare, violență familială, pierdere loc muncă, în unele
țări (RO nu, dar useri din diaspora / travelling) risc penal.
**Probabilitate:** medie (device-sharing e comun).
**Măsuri:**
- Discreet Mode (icon + titlu deghizate — "Calculator", "Notes").
- Fake Call Screen (evacuare rapidă).
- PIN Lock la deschidere (opțional).
- Anti-screenshot (FLAG_SECURE Android).
- Quick Exit FAB.

### 3.2 Șantaj / doxxing (RISC ÎNALT)

**Amenințare:** un match rău-intenționat face capturi/screenshot și le
folosește pentru șantaj.
**Impact:** presiune financiară + risc outing.
**Probabilitate:** medie-mare.
**Măsuri:**
- Private Album (unlock cu approval bilateral).
- ProtectedImage (blur + noise fingerprint).
- Report + Block bilateral (enforced la DB via trigger).
- Consimțământul pentru fotografii intime rămâne user-side (educație în
  Safety page + Community Guidelines).

### 3.3 Stalking fizic (RISC ÎNALT)

**Amenințare:** un match agresiv folosește distanța pentru a localiza userul.
**Impact:** violență fizică.
**Probabilitate:** scăzută-medie (dating apps sunt istoric vulnerabile).
**Măsuri:**
- Coordonatele precise NU pleacă la alți useri (server-side bucketization).
- Distanța se rotunjește în buckets (>1km, 1-5km, 5-25km, 25-100km, >100km).
- Panic Tools (SOS, contacte încredere, fake call).
- Recomandare întâlnire în loc public (Safety page).

### 3.4 Acces minori (RISC ÎNALT — legal)

**Amenințare:** minor <18 accesează platforma.
**Impact:** risc penal operator, trauma minor.
**Probabilitate:** scăzută (verificare biometrică Didit).
**Măsuri:**
- Age gate obligatoriu în producție (`shouldEnforceAgeGate` fail-safe true).
- Selfie live procesat de Didit (age estimation) — pass/fail.
- Trigger DB `enforce_min_age_trg` refuză birthdate <18.
- RPC social gated pe `assert_age_verified`.

### 3.5 CSAM (RISC ÎNALT — legal)

**Amenințare:** un user încarcă material de abuz asupra minorilor.
**Impact:** obligație legală de raportare la NCMEC/autorități RO.
**Probabilitate:** scăzută (comunitate 18+ verificată) dar reală.
**Măsuri:**
- Hash matching la upload (`csam_blocklist` perceptual + sha256).
- Rapoarte user → coada CSAM (fără vizualizare imagine în admin — doar hash-uri).
- Escaladare + ban imediat + păstrare hash pentru autorități.

### 3.6 Scurgere date (RISC MEDIU)

**Amenințare:** breach DB expune orientare + HIV status.
**Impact:** outing masiv al comunității.
**Probabilitate:** scăzută (Supabase managed + măsuri de mai jos).
**Măsuri:**
- RLS pe toate tabelele cu date user.
- HIV cifrat la coloană cu `pgp_sym_encrypt` (cheia `HEALTH_COL_KEY` în env
  server, NU în DB).
- MFA obligatoriu pentru admin + super_admin.
- Break-glass reveal pentru date sensibile (audit + severitate `critical`).
- Backup restore testat (vezi `docs/backup-restore-procedure.md`).

### 3.7 Enumeration / scraping (RISC MEDIU)

**Amenințare:** un bot enumeră toate profilurile pentru a construi listă
publică cu orientare.
**Impact:** dossier LGBTQ+ masiv.
**Probabilitate:** medie (dating apps sunt țintă frecventă).
**Măsuri:**
- Rate limit hard 500 profiluri/oră/user pe `discover_profiles`.
- Rate limit progresiv: după 5 cereri/oră, page size scade la 20.
- Turnstile CAPTCHA obligatoriu în producție la signup.
- Distanță bucketizată (nu coordonate precise) → dosar nu conține locație.

### 3.8 Decizii automate (RISC SCĂZUT)

Nu folosim profilare Art. 22 (nu decidem eligibilitate/preț algoritmic).
Feed rank e euristică + preferințe explicite user. Fără AI generativ peste
conținutul userilor. AI Gateway e folosit doar pentru asistență admin/support
cu consimțământ explicit.

---

## 4. Măsuri de atenuare (tehnice + organizatorice)

### 4.1 Tehnice

- Cifrare la transport: HTTPS/TLS 1.2+ end-to-end obligatoriu.
- Cifrare la disc: Supabase encryption at rest (AES-256).
- Cifrare la coloană: date HIV (`pgp_sym_encrypt`, cheia în env server).
- RLS activ pe toate tabelele cu date user, policies scope pe `auth.uid()`.
- MFA obligatoriu (TOTP) pentru admin + super_admin înainte de acțiuni
  distructive (vezi `assertAdminMfa`).
- Turnstile pe signup + reset password (fail-closed în producție).
- CAPTCHA fail-closed: dacă `VITE_TURNSTILE_SITE_KEY` lipsește în build prod,
  formularele auth sunt blocate.
- Anti-bot rate limit: 60 mesaje/oră, 500 swipes/oră, 10 raporturi/oră.
- Audit log immutable pentru toate acțiunile admin (`admin_audit_log` cu
  trigger `prevent_audit_mutation`).
- Content Security Policy strict (vezi `public/_headers`).
- HSTS + X-Frame-Options DENY + Permissions-Policy restrictiv.
- Android `allowBackup=false` (dating app — no cloud backup).
- Android `AD_ID` permission REMOVED (nu tracking).
- Android `ACCESS_BACKGROUND_LOCATION` REMOVED (geofencing dezactivat).

### 4.2 Organizatorice

- DPO desemnat (dpo@suzeta.ro).
- Registru Art. 30 actualizat la fiecare feature nou (`docs/gdpr-art-30-register.md`).
- Plan incident response (`docs/incident-response-plan.md`).
- Testare backup-restore documentată (`docs/backup-restore-procedure.md`).
- Consimțământ granular (cookies, HIV, AI, push, background location) în UI
  Settings.
- Ștergere cont in-app la /account-deletion + confirmare email + grace 7 zile.
- Community Guidelines cu clauze anti-outing, non-discriminare LGBTQ+.
- Safety page cu 112 + ACCEPT + ARAS.
- Age policy dedicată `/legal/age-policy`.

---

## 5. Concluzie

Prelucrarea este **necesară și proporțională** pentru scopul dating LGBTQ+.
Riscurile identificate (outing, șantaj, stalking, acces minori, scraping) sunt
atenuate prin măsuri tehnice + organizatorice concrete, implementate în cod și
verificabile.

**Reziduu de risc acceptabil:** DA, cu condiția revizuirii trimestriale a
politicilor + audit anual extern.

**Consultare ANSPDCP:** NU necesară în această fază (măsuri de atenuare
suficiente conform Art. 36 GDPR). Se va reconsidera dacă:
- introducem AI decizional peste conținut user,
- extindem în țări cu risc penal LGBTQ+ (list actualizată în `country_risk_config`),
- adăugăm categorii Art. 9 noi (biometrice, date genetice).

**Următoarea revizuire:** 2026-10-13 (trimestrial) sau la orice modificare
materială a fluxurilor de date.

---

## Aprobări (de completat)

- [ ] Operator (Florin, Administrator VOMIX GENIUS S.R.L.) — data:
- [ ] DPO extern (consultant) — data:
- [ ] Consilier juridic (dacă e cazul) — data:

---

## Anexă — actualizare 2026-08-29 (Explorer, retenție, safety check-in)

### 1. Modul Explorer (locație aleasă manual)
- **Prelucrare:** utilizatorul alege manual un oraș; coordonatele sunt rotunjite
  la ~1 km înainte de stocare în `profiles.travel_location` și expiră automat
  după maximum 24 de ore.
- **Temei:** Art. 6(1)(a) consimțământ — acțiune explicită a utilizatorului.
- **Risc:** dezvăluirea prezenței într-o zonă; mitigat prin rotunjire, expirare
  automată, insignă „Explorer" vizibilă (transparență față de ceilalți) și
  avertisment de risc de țară afișat ÎNAINTE de confirmare.
- **Reziduu:** scăzut. Nu se stochează istoric de trasee.

### 2. Notificări de revenire și remindere de conversație
- **Prelucrare:** `last_seen` și existența unui match fără mesaje, evaluate
  server-side de sarcini programate.
- **Temei:** Art. 6(1)(f) interes legitim (reactivarea propriului cont), cu
  frecvență plafonată (o singură notificare la câteva zile) și dezabonare din
  setările de notificări.
- **Conținut:** generic, fără date despre alt utilizator.

### 3. Safety check-in
- **Prelucrare:** momentul verificării, o notă scrisă de utilizator pentru el
  însuși, starea (în așteptare / confirmat / escaladat).
- **Temei:** Art. 6(1)(a) + Art. 6(1)(d) interese vitale la escaladare.
- **Nu se stochează locație.** Escaladarea produce o notificare doar către
  utilizatorul în cauză, cu resursele de urgență.
- **Retenție:** 90 de zile de la finalizare.

### 4. Waitlist pe oraș
- **Prelucrare:** ID utilizator + numele orașului declarat.
- **Temei:** Art. 6(1)(a) consimțământ; înregistrarea poate fi ștearsă oricând
  de utilizator. Contorul afișat este agregat, fără identități.
