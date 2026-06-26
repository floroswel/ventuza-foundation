# Registru al activităților de prelucrare — Ventuza

> **Document intern, conform Art. 30 GDPR (Regulamentul (UE) 2016/679).**
> NU este "înregistrare la ANSPDCP" — obligația de notificare prealabilă a
> autorității a fost eliminată de GDPR în 2018. Acest registru se ține intern
> și se prezintă ANSPDCP doar la cerere (control / investigație).

- **Versiune:** 1.0
- **Data:** 2026-06-26
- **Responsabil:** _de completat — administrator Ventuza_
- **DPO desemnat:** _de completat (obligatoriu — date de sănătate + orientare sexuală + monitorizare sistematică = Art. 37(1)(b)(c))_

---

## 1. Identitatea operatorului

| Câmp | Valoare |
|---|---|
| Denumire operator | _de completat (PFA / SRL care exploatează Ventuza)_ |
| Adresă | _de completat_ |
| CUI / înregistrare | _de completat_ |
| Reprezentant legal | _de completat_ |
| Contact DPO | _de completat — ex. dpo@ventuza.app_ |

---

## 2. Activitatea de prelucrare — "Aplicație de dating Ventuza"

### 2.1 Scopuri

1. Crearea și administrarea contului utilizatorului.
2. Potrivirea (matching) între utilizatori pe baza preferințelor declarate și a locației.
3. Comunicarea între utilizatori (mesaje, taps, woofs, albume private).
4. Organizare și promovare evenimente / grupuri.
5. Verificarea vârstei (18+) și a identității (selfie verification).
6. Prevenirea fraudei, abuzurilor și a conținutului ilegal (CSAM, hărțuire).
7. Procesarea plăților pentru abonamente Premium.
8. Suport, notificări tranzacționale și (opțional) marketing direct.
9. Conformitate legală (DSA, GDPR, raportare CSAM, anaf pentru business accounts).

### 2.2 Categorii de persoane vizate

- Utilizatori finali (persoane fizice, exclusiv 18+).
- Business accounts (operatori comerciali — `business_applications`).
- Persoane raportate de utilizatori (subiectul rapoartelor).

### 2.3 Categorii de date prelucrate

**Date de identificare și cont** (`profiles`, `auth.users`):
`id`, `display_name`, `birthdate`, `pronouns`, `profile_slug`, e-mail (în `auth.users`), `created_at`, `last_seen`.

**Date demografice și de lifestyle** (`profiles`):
`gender`, `ethnicity`, `body_type`, `height_cm`, `weight_kg`, `relationship_status`, `languages`, `education`, `school`, `job_title`, `company`, `religion`, `politics`, `children`, `pets`, `drinking`, `smoking`, `cannabis`, `drugs`, `workout`, `diet`, `zodiac`.

**Date din categorii speciale — Art. 9 GDPR**:
- **Orientare sexuală** (`orientation`, `tribes`, `looking_for`, `scenes`, `position`, `accept_nsfw_photos`).
- **Date privind sănătatea** (`hiv_status`, `hiv_test_date`, `prep_status`, `vaccinations`, `safety_practices`).
- **Convingeri religioase** (`religion`), **opinii politice** (`politics`).

**Date de localizare** (`profiles.location`, `profiles.travel_location`, `profiles.prev_location`):
Coordonate GPS precise, stocate ca `geography(Point)`. **Niciodată expuse altor utilizatori** — afișarea către alți useri se face exclusiv prin distanță bucketizată (`bucket_distance_m`).

**Date biometrice / de verificare** (`profiles.verification_selfie_path`, `age_verifications`):
Selfie pentru verificare, rezultatul verificării vârstei (Didit), `estimated_age`. Selfie-ul nu este folosit pentru identificare automată; este analizat de Didit și nu se stochează datele biometrice rezultate la noi.

**Conținut generat de utilizator**:
`bio`, `prompts`, `photos`, `voice_bio_url`, `video_clip_path`, `stories`, `messages`, `group_messages`.

**Date tehnice și de utilizare**:
`device_fingerprints` (hash + UA), `push_subscriptions`, `risk_signals`, `web_vitals`, `experiment_assignments`, `ad_events`, `profile_views`, `swipes`, `taps`, `woofs`, `favorites`.

**Date de plată**:
`subscriptions` (`platform`, `product_id`, `purchase_token`, `status`, `expires_at`). **Nu** stocăm numere de card; plata e procesată exclusiv de Google Play / RevenueCat.

**Date de consimțământ și conformitate**:
`consent_log` (versiunile acceptate + timestamp + UA), `policy_versions`, `health_data_consent_at`, `marketing_consent_at`, `terms_accepted_at`, `privacy_accepted_at`.

**Date de moderare / safety**:
`reports`, `illegal_content_reports`, `csam_reports`, `blocks`, `risk_flags`, `breach_incidents`, `admin_audit_log`, `sos_events`, `deletion_requests`.

### 2.4 Temei legal

| Scop | Temei (Art. 6) | Temei special (Art. 9) |
|---|---|---|
| Cont, matching, mesaje, profil | 6(1)(b) executarea contractului | 9(2)(a) consimțământ explicit pentru orientare sexuală și date de sănătate, înregistrat în `consent_log` și pe `profiles.health_data_consent_at` |
| Plată abonament | 6(1)(b) executarea contractului | — |
| Verificare vârstă | 6(1)(c) obligație legală (DSA art. 28, protecție minori) + 6(1)(f) interes legitim | — |
| Moderare / safety / CSAM | 6(1)(c) obligație legală + 6(1)(f) interes legitim | 9(2)(g) interes public substanțial |
| Marketing direct | 6(1)(a) consimțământ (`marketing_consent_at`) | — |
| Conformitate (audit log, raportări) | 6(1)(c) obligație legală | — |
| Securitate (fingerprint, risk score) | 6(1)(f) interes legitim — prevenirea fraudei | — |

### 2.5 Categorii de destinatari (procesatori — Art. 28)

| Destinatar | Rol | Date partajate | Locație | Mecanism transfer |
|---|---|---|---|---|
| **Supabase (via Lovable Cloud)** | Persistență DB, Auth, Storage, Realtime | Toate datele aplicației | EU (eu-central) | DPA Supabase + SCC pentru sub-procesatori US |
| **Google LLC** — Google Play Billing | Procesare plăți Android | `app_user_id`, `purchase_token`, `product_id` | US | SCC (EU↔US) + Adequacy Decision (DPF) |
| **Google LLC** — Google OAuth (sign-in) | Autentificare | E-mail, sub Google | US | SCC + DPF |
| **RevenueCat, Inc.** | Orchestrare abonamente | `app_user_id`, ID achiziție | US | SCC + DPF |
| **Didit** | Verificare vârstă (18+) | Selfie, rezultat estimare vârstă | EU | DPA Didit |
| **Lovable AI Gateway** | Funcționalități AI (ex. moderare text, embeddings) | Conținut text trimis explicit la AI | EU/US (în funcție de model) | SCC dacă model US |
| **Cloudflare** (workers, CDN) | Runtime server + asset delivery | Headere HTTP, IP, payload request | Global | SCC + DPF |
| **ANSPDCP / autorități române** | Doar la cerere oficială | După caz | RO | Obligație legală |
| **NCMEC / autorități penale** | Raportare CSAM | Rapoarte și hash-uri în `csam_reports` | US / RO | Obligație legală |

Lista completă, mereu actualizată, se găsește la `/legal/subprocessors`.

### 2.6 Transferuri în afara UE/SEE

- **Google, RevenueCat, Cloudflare, eventual modele AI:** SUA.
- **Mecanism:** Standard Contractual Clauses (SCC — Decizia CE 2021/914) + EU-US Data Privacy Framework pentru organizațiile certificate (Google, Cloudflare).
- **Evaluare transfer (TIA):** _de făcut și anexat — obligatoriu post Schrems II._

### 2.7 Termene de retenție

| Categorie | Termen | Sursă în cod |
|---|---|---|
| Cont activ + profil | Pe durata existenței contului | — |
| Cont inactiv (fără login) | **Marcat pentru ștergere la 24 luni** de inactivitate; purjat după 30 zile grace | `public.mark_inactive_for_deletion` + `public.purge_scheduled_deletions` (pg_cron, zilnic 03:15/03:30 UTC) |
| Cerere de ștergere user | Procesată imediat (immediate-purge) | `deleteMyAccount` în `src/lib/account.functions.ts` |
| Mesaje | Cascadat la ștergerea contului expeditorului | FK cascade pe `messages` |
| Verificare vârstă | 24 luni (audit + reapelare în caz de re-cont) | `age_verifications` |
| Loguri admin / audit | 24 luni | `admin_audit_log` |
| Rapoarte / moderare | 36 luni (apel + investigație autorități) | `reports`, `illegal_content_reports` |
| CSAM reports | Permanent (obligație legală) + transmise NCMEC | `csam_reports` |
| Plăți / facturare | 10 ani (Cod fiscal RO) | `subscriptions` |
| Consimțăminte | Pe durata contului + 3 ani după ștergere | `consent_log` |
| Web vitals / analytics anonim | 90 zile | `web_vitals` |

### 2.8 Drepturile persoanei vizate — implementare tehnică

| Drept (Art.) | Implementare |
|---|---|
| Acces (15) | Export JSON via `exportMyData` în `src/lib/account.functions.ts` |
| Rectificare (16) | UI profil (`src/routes/profile.tsx`) |
| Ștergere (17) | `deleteMyAccount` — cascade DB + storage + anulare RevenueCat |
| Restricție (18) | Setare `incognito` + `discreet_mode` |
| Portabilitate (20) | Același export JSON (format machine-readable) |
| Opoziție (21) | Dezactivare marketing din Setări |
| Retragere consimțământ (7(3)) | Pentru date de sănătate: ștergerea câmpului în profil; pentru marketing: toggle Setări |
| Plângere la ANSPDCP | Link în Privacy Policy |

### 2.9 Măsuri tehnice și organizatorice (Art. 32)

- **Cifrare în tranzit:** HTTPS/TLS 1.2+ pe toate endpoint-urile.
- **Cifrare la rest:** AES-256 (Supabase managed) pentru DB și storage.
- **Cifrare la nivel de coloană pentru date sănătate:** _pregătit ca migrație draft (`docs/migrations-draft/encrypt-hiv-columns.md`), neaplicat la 2026-06-26 — decizie pendinte._
- **RLS:** activat pe toate cele 60 de tabele publice; politici scoped pe `auth.uid()`.
- **Funcții SECURITY DEFINER:** auditate; `discover_profiles` nu mai expune `hiv_status`, `hiv_test_date` sau coordonate precise.
- **Locație:** stocată precis, expusă altora doar bucketizată (`bucket_distance_m`).
- **Verificare vârstă:** obligatorie pre-onboarding.
- **MFA admin:** `admin_mfa_status` + `admin_ip_allowlist`.
- **Rate limiting:** `check_rate_limit` per acțiune sensibilă.
- **Audit log:** `admin_audit_log`, `deletion_requests`, `consent_log`.
- **Backup-uri:** managed Supabase, retenție conform plan.
- **Procedura de breach:** `breach_incidents` + notificare 72h ANSPDCP (Art. 33).
- **PIN lock + biometric** local pentru app mobil (`src/components/PinLockGate.tsx`).

### 2.10 DPIA (Art. 35) — obligatoriu

Combinație: date sănătate + orientare sexuală + locație + monitorizare sistematică + risc minori = **DPIA obligatoriu**. _A se realiza și anexa separat înainte de lansare în producție comercială._

---

## 3. Documente conexe

- Privacy Policy publică: `/legal/privacy`
- Termeni: `/legal/terms`
- Cookies: `/legal/cookies`
- Sub-procesatori: `/legal/subprocessors`
- Incident response: `/legal/security-incidents`
- DSA — coordonator: `/legal/dsa`
- Migrație draft cifrare coloană: `docs/migrations-draft/encrypt-hiv-columns.md`
