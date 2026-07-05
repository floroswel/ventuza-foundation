# RAPORT — Inventar pagini legale Ventuza

**Zero modificări făcute.** Toate paginile sunt în `src/routes/`, în limba **română** (nicio pagină nu are versiune EN separată în afară de câteva string-uri bilingve în `legal.badges.tsx`).

## Sumar operator menționat

- **VOMIX GENIUS S.R.L.** apare **într-un singur loc**: `legal.data-safety.tsx` linia 200 ("Această pagină este întreținută de VOMIX GENIUS S.R.L. pentru Ventuza").
- **Restul paginilor** menționează operatorul doar ca **"Ventuza"** (marca), fără CUI, fără J40, fără adresă sediu, fără reprezentant legal.
- `legal.business-terms.tsx` spune explicit: *"Date de identificare fiscală vor fi completate la înregistrarea SRL"* — placeholder recunoscut.
- Emailuri folosite peste tot: `@ventuza.app` (privacy, dpo, dsa, abuse, csam, trust, appeals, copyright, security, support, business, parents).

## Inventar pagină cu pagină

### 1. `/legal/terms` — `legal.terms.tsx` (163 linii)
- **Stare:** parțial-spre-complet. Conținut real scris.
- **Operator:** doar "Ventuza", fără date fiscale.
- **HIV:** menționat explicit — *"Ventuza nu procesează date despre statutul HIV"*.
- **Didit:** NU.
- **Biometrice:** menționat indirect ("moderarea internă").
- **Lipsă:** CUI/sediu/jurisdicție exactă, SAL/ANPC link, versiune + dată efectivă.

### 2. `/legal/privacy` — `legal.privacy.tsx` (247 linii)
- **Stare:** complet ca structură, dar operator gol.
- **Operator (secțiunea 10):** *"Operator: Ventuza · Email DPO: privacy@ventuza.app"* — fără CUI/J40/adresă/DPO nume.
- **HIV:** menționat explicit ca **eliminat** ("NU procesăm date despre statutul HIV").
- **Biometrice:** DA — *"Selfie de verificare 18+ — Art. 9(1) date biometrice"*, temei 9(2)(a) consimțământ explicit.
- **Didit:** NU (flux intern declarat).
- **Categorii date enumerate:** email, telefon opțional, poze profil, selfie biometric verificare, orientare, gen, pronume, locație aproximativă (bucket), mesaje, date facturare business (CUI).
- **Lipsă:** identificare completă operator, DPO nominal, retenții exacte per categorie, drepturi ANSPDCP (URL).

### 3. `/legal/cookies` — `legal.cookies.tsx` (97 linii)
- **Stare:** parțial. Buton reset consimțământ funcțional (`ventuza_cookie_consent_v2`).
- **Operator:** "Ventuza", contact `privacy@` + `dpo@`.
- **HIV/Didit/biometrice:** NU.
- **Lipsă:** tabel exact cookie-uri per categorie (nume, durată, third-party), listă exactă cookie-uri strict-necesare.

### 4. `/legal/dmca` — `legal.dmca.tsx` (121 linii)
- **Stare:** complet ca procedură (notificare + contra-notificare).
- **Operator:** "Ventuza". Contact `copyright@ventuza.app`, `dpo@ventuza.app`.
- **Bază legală:** Legea 8/1996 + Directiva UE citată.
- **HIV/Didit/biometrice:** NU.
- **Lipsă:** agent DMCA nominal.

### 5. `/legal/age-policy` — `legal.age-policy.tsx` (140 linii)
- **Stare:** complet.
- **Operator:** "Ventuza".
- **Didit:** NU — declară explicit *"moderator Ventuza. Nu implicăm procesator KYC extern"*.
- **Biometrice:** DA (liveness selfie, retenție ≤30 zile, bucket privat).
- **HIV:** NU.
- **Contact:** abuse@, csam@, parents@.

### 6. `/legal/community` — `legal.community.tsx` (133 linii)
- **Stare:** complet.
- **Operator:** "Ventuza".
- **Include:** interzicere outing, helpline-uri LGBTQ+ (implicit prin appeals@, trust@).
- **HIV/Didit/biometrice:** NU.

### 7. `/legal/business-terms` — `legal.business-terms.tsx` (120 linii)
- **Stare:** **schelet-parțial**. Recunoaște deschis că datele fiscale lipsesc.
- **Operator:** *"Ventuza — platformă de socializare LGBTQ+. Date de identificare fiscală vor fi completate la înregistrarea SRL."* Contact `business@ventuza.app`.
- **HIV/Didit/biometrice:** NU.
- **Lipsă critică:** CUI, J40, adresă sediu, IBAN emitent, SAL, drept retragere B2B.

### 8. `/legal/records-of-processing` (Registru Art. 30) — `legal.records-of-processing.tsx` (303 linii)
- **Stare:** **complet și detaliat**. Include: activități, temei Art. 6/Art. 9, categorii persoane vizate, categorii date, destinatari, retenție.
- **Operator:** "Ventuza", DPO `dpo@ventuza.app`.
- **HIV:** menționat explicit ca **eliminat** (în `TODOS`: *"Procesare HIV eliminată complet (coloane dropate, funcții șterse, kind consent scos)"*).
- **Biometrice:** DA — Art. 9(2)(a) + Art. 9(2)(g) pentru selfie verificare.
- **Didit:** NU.

### 9. `/legal/subprocessors` — `legal.subprocessors.tsx` (255 linii)
- **Stare:** **complet**. Sursă autoritativă conform REGULĂ PROCESATORI din project-knowledge.
- **Operator:** "Ventuza", DPO `dpo@ventuza.app`.
- **Include:** ANAF (lookup CUI, marcat operator independent, nu procesator).
- **HIV/Didit/biometrice:** NU (verificarea 18+ e declarată internă, deci nu apare Didit).
- **Lipsă:** dacă adaugi Didit ca procesator KYC, trebuie inclus aici + în Art. 30.

### 10. `/legal/data-safety` — `legal.data-safety.tsx` (364 linii) — **cea mai bogată**
- **Stare:** complet, categorii detaliate cu scop + control user.
- **Operator:** **SINGURA pagină** care menționează *"VOMIX GENIUS S.R.L. pentru Ventuza"* (linia 200).
- **Include:** poze profil, selfie verificare biometric, date business (Denumire firmă, CUI, Adresă sediu, Email facturare).
- **HIV:** NU (eliminat).
- **Didit:** NU.

### 11. `/legal/dsa` — `legal.dsa.tsx` (108 linii)
- **Stare:** complet (Art. 16 + Art. 20 DSA acoperite).
- **Operator:** "Ventuza", stabilită în România/UE.
- **Contact:** `dsa@ventuza.app`, `trust@ventuza.app`, `appeals@ventuza.app`.
- **HIV/Didit/biometrice:** NU.

### 12. `/legal/security-incidents` — `legal.security-incidents.tsx` (104 linii)
- **Stare:** parțial. Procedură + contact `security@ventuza.app`.
- **Operator:** "Ventuza".
- **HIV/Didit/biometrice:** NU.
- **Lipsă:** SLA-uri exacte notificare ANSPDCP (72h Art. 33), template registru breșe.

### 13. `/legal/badges` — `legal.badges.tsx` (95 linii)
- **Stare:** catalog badge-uri, **bilingv RO/EN** (folosește helper `t(ro, en)`).
- Nu e pagină legală propriu-zisă (explicativă produs).

### 14. `/safety` — `safety.tsx` (218 linii)
- **Stare:** complet — centru de siguranță user-facing.
- **HIV:** menționat contextual în resurse (testare HIV/ITS, PrEP, PEP, TasP) ca **resursă externă**, nu ca date procesate.
- **Include:** 112, ACCEPT, ARAS (conform REGULĂ DOCUMENTE LEGALE P0).

## Ce trebuie completat (rezumat pentru decizie)

**Nimic de rescris de la zero.** Toate paginile au conținut real. Ce lipsește:

1. **Identificare operator completă** — CUI, J40, adresă sediu, DPO nominal, IBAN emitent — trebuie **injectat consecvent în toate paginile** (acum apare doar "Ventuza" peste tot și "VOMIX GENIUS S.R.L." într-un singur loc).
2. **Business terms (P0)** — recunoaște singur că îi lipsesc datele fiscale + IBAN + SAL/ANPC.
3. **Cookies** — tabel exact cookie-uri.
4. **Security incidents** — SLA 72h Art. 33 explicit.
5. **Dacă introduci Didit** ca procesator KYC: trebuie adăugat în `subprocessors.tsx` + `records-of-processing.tsx` + `age-policy.tsx` + `privacy.tsx` (acum toate declară flux intern, fără procesator extern).

Confirmă ce vrei să completez și în ce ordine (sau dă-mi datele firmei ca să fac update global consecvent într-un sprint).
