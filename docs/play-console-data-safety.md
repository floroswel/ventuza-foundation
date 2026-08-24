# Google Play — Data Safety Form (copy-paste ready)

Ultima actualizare: 2026-07-13. Sursa de adevăr pentru procesatori:
`src/routes/legal.subprocessors.tsx`. Sursa pentru scopuri/tempeiuri:
`docs/gdpr-art-30-register.md`.

---

## Answer keys (rezumat operator → Play Console)

- **Does your app collect or share any of the required user data types?** → **Yes**
- **Is all of the user data collected by your app encrypted in transit?** → **Yes** (HTTPS/TLS 1.2+ end-to-end; storage cifrată la coloană pentru date sănătate — vezi `HEALTH_COL_KEY`).
- **Do you provide a way for users to request that their data be deleted?** → **Yes**
  - In-app: `/account-deletion` (declanșează `deletion_requests` → purge automat).
  - Email: `dpo@suzeta.ro` (răspuns ≤ 30 zile, GDPR Art. 17).
- **Has your app been independently validated against a global security standard?** → **No** (planificat: audit extern Q4 2026).

---

## Data types collected

Coloanele "Shared?" reflectă transmitere către terți în afara procesatorilor
strict necesari serviciului (procesatorii NU se raportează ca "Shared" în
formularul Google — ei sunt "Collected" prin definiția Play, atât timp cât
prelucrează pentru contul de dezvoltator).

### Location

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Precise location (lat/lng) | Yes | No | Yes | App functionality (matching, hartă owner-only), Analytics agregat (bucket) | Yes | Yes | Supabase (EU — Frankfurt) |
| Approximate location (city / country) | Yes | No | Yes | App functionality (Nearby, filtre), Fraud prevention (Country Risk) | Yes | Yes | Supabase (EU), Cloudflare (edge/CDN) |

**Notă important**: coordonatele precise NU se returnează niciodată către alți
utilizatori — RPC-urile server-side returnează doar distanță bucketizată
(`bucket_distance_m`). Owner-ul își vede propriul pin.

### Personal info

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Name / display name | Yes | No | No | Account management, App functionality | Yes | Yes | Supabase |
| Email address | Yes | No | No | Account management, Communications | Yes | Yes | Supabase, Resend (transactional email) |
| User IDs (UUID intern) | Yes | No | No | Account management, Analytics, Fraud prevention | Yes | Yes | Supabase, RevenueCat (entitlements) |
| Phone number | Yes (optional, contacte SOS) | No | Yes | Personal safety (SOS) | Yes | Yes | Supabase |
| Address | No | — | — | — | — | — | — |
| Race and ethnicity | No | — | — | — | — | — | — |
| Political or religious beliefs | No | — | — | — | — | — | — |
| Sexual orientation | Yes | No | Yes | App functionality (matching queer-first) | Yes | Yes | Supabase (Art. 9 GDPR — consimțământ explicit) |
| Other info (pronouns, gender, tribes) | Yes | No | Yes | App functionality (identity display) | Yes | Yes | Supabase (Art. 9) |

### Financial info

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| User payment info | No (partenerii B2B plătesc prin transfer bancar direct la Suzeta) | — | — | — | — | — | — |
| Purchase history | Yes (parteneri B2B — facturi) | No | No | Account management, Compliance (ANAF e-Factura) | Yes | Restricționat (retenție 10 ani — legislație fiscală RO) | Supabase, ANAF (autoritate publică) |
| Credit info / other financial | No | — | — | — | — | — | — |

### Health and fitness

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Health info (HIV status, test date) | Yes | No | Yes (opt-in explicit) | App functionality (harm reduction — user alege să afișeze) | **Yes + cifrat la coloană (`pgp_sym_encrypt`)** | Yes (retragere consimțământ → wipe automat) | Supabase (Art. 9 — consimțământ explicit înregistrat în `consent_log`) |

### Messages

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Emails | No (transactional doar) | — | — | — | — | — | — |
| SMS / MMS | No | — | — | — | — | — | — |
| Other in-app messages | Yes | No | No | App functionality (chat 1:1) | Yes | Yes (unsend + delete conversation) | Supabase |

### Photos and videos

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Photos | Yes | No | Yes | App functionality (profil, chat media), Fraud prevention (moderare CSAM hash) | Yes | Yes | Supabase Storage (EU) |
| Videos | Yes (video clip profil) | No | Yes | App functionality | Yes | Yes | Supabase Storage |

### Audio files

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Voice recordings (voice prompts chat) | Yes | No | Yes | App functionality | Yes | Yes | Supabase Storage |
| Music files | No | — | — | — | — | — | — |
| Other audio | No | — | — | — | — | — | — |

### Files and docs

| Type | Collected | Shared | Optional | Purpose |
| ---- | --------- | ------ | -------- | ------- |
| Files and docs | No | — | — | — |

### Calendar / Contacts

| Type | Collected | Shared |
| ---- | --------- | ------ |
| Calendar events | No | — |
| Contacts | No (userul introduce manual contactele SOS — nu accesăm agenda) | — |

### App activity

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| App interactions (taps, swipe, matches) | Yes | No | No | Analytics agregat, App functionality (feed rank) | Yes | Yes | Supabase |
| In-app search history | Yes (filtre salvate) | No | Yes | App functionality (saved views) | Yes | Yes | Supabase |
| Installed apps | No | — | — | — | — | — | — |
| Other user-generated content | Yes (bio, prompturi, badges) | No | Yes | App functionality | Yes | Yes | Supabase |
| Other actions | Yes (proximity notification hits pentru anti-spam) | No | No | Fraud prevention (cooldown, daily cap) | Yes | Yes | Supabase |

### Web browsing

| Type | Collected |
| ---- | --------- |
| Web browsing history | No |

### App info and performance

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Crash logs | Yes | No | No | Analytics, App functionality | Yes | Yes (asociate cu user_id și șterse la delete) | Supabase (log intern) |
| Diagnostics | Yes (web vitals agregat) | No | No | Analytics | Yes | Yes | Supabase |
| Other app performance data | No | — | — | — | — | — | — |

### Device or other IDs

| Type | Collected | Shared | Optional | Purpose | Encrypted in transit | Deletable | Procesator |
| ---- | --------- | ------ | -------- | ------- | -------------------- | --------- | ---------- |
| Device or other IDs (device fingerprint, push token) | Yes | No | No | Fraud prevention (ban evasion), App functionality (push notifications) | Yes | Yes | Supabase, Firebase Cloud Messaging (push), Cloudflare (edge) |

**IMPORTANT**: NU folosim Android Advertising ID (`AD_ID`). Vezi mai jos —
manifest-ul îl scoate explicit din merged manifest.

---

## Third parties (subprocesatori — sincron cu `/legal/subprocessors`)

| Procesator | Rol | Regiune | Ce date atinge | Bază transfer |
| ---------- | --- | ------- | -------------- | ------------- |
| **Supabase** (Cloud) | Bază de date, Auth, Storage, Realtime | Frankfurt (EU) | Toate datele persistente (profile, mesaje, media, health cifrat, tokens push) | UE — fără transfer |
| **Cloudflare** | CDN/edge, Turnstile (anti-bot), R2 (opțional) | Global (EU config) | IP hash (Turnstile), assets statice | SCC 2021/914 + EU-US DPF |
| **Didit** | Age verification (Art. 9 — selfie tranzitoriu, șters imediat) | EU | Selfie live (transitor, non-persistent), verdict pass/fail | UE |
| **Firebase Cloud Messaging** (Google LLC) | Push notifications | Global | Push token (opac), payload minim (titlu + distanță bucket) | EU-US DPF |
| **RevenueCat** | Entitlements abonament (schelet dormant — free pentru useri, activ pentru B2B viitor) | US | UUID intern, plan code | EU-US DPF + SCC |
| **Resend** | Email tranzacțional (confirm cont, reset parolă, notificări) | US | Email, conținut email | SCC + EU-US DPF |
| **ANAF** | Autoritate fiscală RO (e-Factura pentru parteneri B2B) | RO | Facturi B2B (denumire firmă, CUI, IBAN, sumă) | Obligație legală (Art. 6(1)(c) GDPR) |

---

## Deletion & retention

- **Cerere ștergere in-app**: `/account-deletion` → creează `deletion_requests`
  → job automat `admin_run_purge_now` șterge cascadat toate datele în ≤ 7 zile
  (grace period pentru anulare).
- **Retenție obligatorie**: facturi partener (10 ani — Cod fiscal RO Art. 25),
  audit log admin (5 ani — DSA/GDPR), consent log (durata cont + 3 ani post).
- **Cifrare la coloană** (peste cifrarea la disc Supabase): coloanele
  `hiv_status_enc`, `hiv_test_date_enc` folosesc `pgp_sym_encrypt`; decriptarea
  se face doar prin RPC `get_user_health` (grant service_role); cheia
  `HEALTH_COL_KEY` trăiește în secret env.

---

## Ads / Advertising ID

**Nu folosim advertising**. FCM și RevenueCat pot declara `AD_ID` în manifest —
îl scoatem explicit:

```xml
<!-- android/app/src/main/AndroidManifest.xml, în <manifest ...> root -->
xmlns:tools="http://schemas.android.com/tools"

<!-- înainte de </manifest> -->
<uses-permission android:name="com.google.android.gms.permission.AD_ID"
                 tools:node="remove"/>
```

În Play Console → Data Safety → **"Does your app use advertising ID?" → No**.

---

## Content Rating (IARC)

- **Categoria**: Social networking / Dating (18+).
- **Elemente relevante**: user-generated content, mesagerie 1:1, referință
  sexualitate (orientare), fără violență, fără gambling, fără reclame.
- **Age gate**: verificare selfie Didit (age estimation) — vezi
  `/legal/age-policy`.

## Target audience & content

- **Target audience**: Adults only (18+).
- **Appeals to children**: No.

---

## Ce completezi tu în consolă (checklist)

- [ ] Copiază tabelele "Data types collected" în secțiunile corespunzătoare.
- [ ] La fiecare tip: "Collected" = Yes, "Shared" = No, "Encrypted in transit" = Yes, "Users can request deletion" = Yes.
- [ ] Bifează "Optional" doar pentru câmpurile marcate ca opt-in mai sus.
- [ ] La "Data collection and security": link către `/legal/privacy`.
- [ ] La "Advertising ID": No.
- [ ] La "Independent security review": No (până facem audit extern).
