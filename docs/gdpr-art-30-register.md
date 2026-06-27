# Registru al activităților de prelucrare — Ventuza (Art. 30 GDPR)

> **Document intern, conform Art. 30 GDPR (Regulamentul (UE) 2016/679).**
> NU se depune la ANSPDCP (obligația de notificare prealabilă a fost
> eliminată în 2018). Se ține intern și se prezintă autorității doar la
> cerere (control / investigație). Se actualizează la fiecare schimbare
> de activitate, scop, procesator sau categorie de date.

- **Versiune:** 2.1
- **Data:** 2026-06-27
- **Generat din:** schema reală DB (`src/integrations/supabase/types.ts`) + inventar procesatori (`src/routes/legal.subprocessors.tsx`) + cod server (`src/lib/*.functions.ts`, `*.server.ts`).
- **Responsabil:** _de completat — administrator Ventuza_
- **DPO:** _de completat (obligatoriu — Art. 37(1)(b)(c): date sănătate + orientare + monitorizare sistematică)_

---

## 0. Operator

| Câmp | Valoare |
|---|---|
| Denumire operator | _de completat (PFA / SRL care exploatează Ventuza)_ |
| Sediu | _de completat_ |
| CUI / nr. reg. | _de completat_ |
| Reprezentant legal | _de completat_ |
| Contact DPO | dpo@ventuza.app |

---

## 0.1 Legendă procesatori (mapare scurtă)

| Cod | Procesator | Regiune | Transfer extra-UE |
|---|---|---|---|
| **P1** | Supabase (via Lovable Cloud) | UE — Frankfurt | — |
| **P2** | Google Play Billing (Android Publisher API) | SUA | SCC 2021/914 + DPF |
| **P3** | Google OAuth (Sign-In) | SUA | SCC + DPF |
| **P4** | Push services (FCM / APNs / Mozilla autopush) | SUA + mixt | SCC + DPF |
| **P5** | RevenueCat | SUA | SCC + DPF |
| **P6** | Didit (age verification) | UE | — |
| **P7** | Lovable AI Gateway | UE/SUA în funcție de model | SCC dacă model US |
| **P8** | Cloudflare Workers (runtime) | Global edge | SCC + DPF |
| **P9** | ANAF (lookup CUI business) | RO | — (operator independent, nu procesator) |

Inventarul complet și DPA-urile sunt în `/legal/subprocessors`.

---

# Activități de prelucrare

## A1. Gestionare cont și profil utilizator

| | |
|---|---|
| **Scop** | Crearea contului, autentificare, păstrare profil de bază, preferințe UI, sesiune. |
| **Persoane vizate** | Utilizatori finali (18+). |
| **Categorii date — normale** | `auth.users` (email, parolă hash, providers), `profiles` câmpuri de identificare/demografice (display_name, birthdate, pronouns, gender, ethnicity, body_type, height_cm, weight_kg, relationship_status, languages, education, school, job_title, company, religion, politics, children, pets, drinking, smoking, cannabis, drugs, workout, diet, zodiac), `profile_slug`, `last_seen`, `device_fingerprints`, `risk_flags`. |
| **🟥 Categorii Art. 9** | `orientation`, `tribes`, `looking_for`, `scenes`, `position`, `accept_nsfw_photos` (orientare sexuală + viață sexuală). `religion`, `politics` (convingeri). |
| **Temei Art. 6** | 6(1)(b) executarea contractului. |
| **Temei Art. 9** | **9(2)(a) consimțământ explicit** — înregistrat în `consent_log` (kind `terms`, `privacy`) la onboarding, în `src/routes/n.tsx`. |
| **Destinatari** | P1 (storage primar), P3 (autentificare Google), P8 (runtime). |
| **Transfer extra-UE** | P3, P8 — SCC + DPF. |
| **Retenție** | Pe durata existenței contului. **24 luni inactivitate → mark_inactive_for_deletion**; 30 zile grace → `purge_scheduled_deletions` (pg_cron zilnic). |
| **Măsuri tehnice** | RLS scoped pe `auth.uid()` pe toate tabelele `profiles`/`auth`-derivate. Encryption-at-rest AES-256. Secrets server-only. PIN lock + biometric pe mobil. |

---

## A2. Matching / Discover (cărți, swipes, filtre)

| | |
|---|---|
| **Scop** | Afișarea altor profile compatibile pe baza preferințelor și a proximității; gestionarea swipe/match. |
| **Persoane vizate** | Utilizatori finali. |
| **Categorii date — normale** | Proiecție profil public (display_name, photos, age, bucket_distance), `swipes`, `matches`, `favorites`, `profile_views`. |
| **🟥 Categorii Art. 9** | Filtre pe `orientation` / `tribes` / `looking_for` (orientare sexuală) — procesate **doar server-side** pentru matching; nu sunt expuse în payload. |
| **Date de localizare** | `profiles.location` (geography Point) — citită doar owner sau prin `SECURITY DEFINER` care întoarce **exclusiv** `bucket_distance_m` (`public.bucket_distance_m`). |
| **Temei Art. 6** | 6(1)(b) executarea contractului. |
| **Temei Art. 9** | 9(2)(a) consimțământ explicit (același onboarding). |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | Pe durata contului; cascade la ștergere. `profile_views` 90 zile. |
| **Măsuri tehnice** | RPC `discover_profiles` cu proiecție restrânsă (fără `hiv_status`, fără coordonate). Distanță bucketizată exclusiv (`bucket_distance_m`, `distance_bucket_label`). Owner-only RLS pe `location`. |

---

## A3. Mesagerie 1:1 + grupuri + media privată

| | |
|---|---|
| **Scop** | Comunicare directă între matchuri, grupuri tematice, albume foto private cu unlock. |
| **Persoane vizate** | Utilizatori finali (expeditor + destinatar). |
| **Categorii date — normale** | `conversations`, `messages` (text, attachments, voice notes, replies), `group_messages`, `group_members`, `groups`, `private_albums`, `album_requests`, `album_unlocks`, `stories`, `story_views`, `taps`, `woofs`. Storage: foto/video/voice. |
| **🟥 Categorii Art. 9** | Conținut user-generated poate releva orientare / viață sexuală / sănătate (mesaj sau foto NSFW în album privat). Tratat ca Art. 9 prin scop. |
| **Temei Art. 6** | 6(1)(b) executarea contractului. |
| **Temei Art. 9** | 9(2)(a) consimțământ explicit (terms + privacy la onboarding acoperă comunicarea în platformă). |
| **Destinatari** | P1 (storage + realtime), P4 (notificare push „Mesaj nou" — fără conținut sensibil în payload), P8. |
| **Transfer extra-UE** | P4, P8 — SCC + DPF. |
| **Retenție** | Pe durata contului expeditorului; cascade FK la ștergere. Albume private — ștergere imediată la `deleteMyAccount`. |
| **Măsuri tehnice** | RLS pe conversație (doar participanți). Storage path scoped pe user_id. ProtectedImage cu URL semnat. Notificările push nu conțin conținutul mesajului. |

---

## A4. Verificare vârstă (18+) — Didit

| | |
|---|---|
| **Scop** | Confirmare vârstă minimă legală (DSA + protecție minori); blocare conturi sub 18 ani. |
| **Persoane vizate** | Utilizatori în onboarding. |
| **Categorii date — normale** | `age_verifications` (`status`, `estimated_age`, `decision_at`, `vendor_session_id`, `vendor_data=user_id`). |
| **🟥 Categorii Art. 9 — date biometrice** | Selfie capturat în fluxul hosted Didit. Nu stocăm noi datele biometrice rezultate; doar rezultatul estimării (`estimated_age`). Path selfie pe storage: `profiles.verification_selfie_path` (owner-only). |
| **Temei Art. 6** | 6(1)(c) obligație legală (DSA Art. 28, protecție minori) + 6(1)(f) interes legitim (prevenirea accesului minorilor la conținut adult). |
| **Temei Art. 9** | 9(2)(a) consimțământ explicit pentru biometric (înregistrat în `consent_log` kind `age_verification` la pornirea fluxului) + 9(2)(g) interes public substanțial (protecția minorilor). |
| **Destinatari** | P1 (status + path), P6 Didit (selfie + vendor_data), P8 (runtime + webhook `/api/public/age-webhook`). |
| **Transfer extra-UE** | — (Didit este în UE). |
| **Retenție** | `age_verifications`: 24 luni (audit + reapelare). Selfie storage: ștergere la `deleteMyAccount` + politică Didit. |
| **Măsuri tehnice** | Webhook semnat HMAC, validare în `src/routes/api/public/age-webhook.ts`. `vendor_data` = doar UUID intern. Niciun PII suplimentar trimis la Didit. |

---

## A5. Abonamente Premium (plată Android)

| | |
|---|---|
| **Scop** | Vânzare acces Premium, validare plată, anulare la cerere. |
| **Persoane vizate** | Utilizatori finali plătitori. |
| **Categorii date — normale** | `subscriptions` (`platform`, `product_id`, `purchase_token`, `status`, `expires_at`, `app_user_id`). |
| **🟥 Categorii Art. 9** | Niciuna. |
| **Date de plată** | Nu stocăm date de card. Procesare integrală la Google Play. |
| **Temei Art. 6** | 6(1)(b) executarea contractului. |
| **Temei Art. 9** | N/A. |
| **Destinatari** | P1, P2 Google Play (validare server-to-server via `src/lib/google-play.server.ts`), P5 RevenueCat (orchestrare + anulare la ștergere via `src/lib/revenuecat.server.ts`), P8. |
| **Transfer extra-UE** | P2, P5, P8 — SCC + DPF. |
| **Retenție** | **10 ani — obligație fiscală (Cod fiscal RO, OUG 28/1999)**. Anularea logică se face la `deleteMyAccount` (DELETE customer RevenueCat), dar înregistrarea contabilă rămâne. |
| **Măsuri tehnice** | JWT RS256 Web Crypto pentru Google API. Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `REVENUECAT_SECRET_API_KEY` server-only. RTDN webhook în `src/routes/api/public/google-play-rtdn.tsx`. Niciun email trimis la RC/Google — doar UUID intern. |

---

## A6. Notificări push (web + mobil)

| | |
|---|---|
| **Scop** | Anunțuri tranzacționale (mesaj nou, match, tap/woof, eveniment). Modul Discret pentru titluri neutre. |
| **Persoane vizate** | Utilizatori care au activat push. |
| **Categorii date — normale** | `push_subscriptions` (`endpoint`, `p256dh`, `auth`, `user_agent`, `platform`). Payload: titlu scurt + body neutru. |
| **🟥 Categorii Art. 9** | Niciuna în payload. Endpoint-ul nu este sensibil. |
| **Temei Art. 6** | 6(1)(a) consimțământ (activare explicită din `EnablePushButton`) + 6(1)(b) pentru notificări tranzacționale strict legate de cont. |
| **Temei Art. 9** | N/A — payload-ul nu conține Art. 9 by design (Modul Discret). |
| **Destinatari** | P1 (stocare subscription), P4 FCM/APNs/Mozilla (livrare), P8 (server function `src/lib/web-push.server.ts`). |
| **Transfer extra-UE** | P4, P8 — SCC + DPF. |
| **Retenție** | Pe durata subscription; ștergere automată la 410 Gone de la provider sau la dezactivare. |
| **Măsuri tehnice** | VAPID. Modul Discret enforce text neutru pentru tipuri sensibile. Service worker `public/push-sw.js`. |

---

## A7. Raportare conținut ilegal & moderare DSA

| | |
|---|---|
| **Scop** | Conformitate DSA Art. 16, primirea și triajul rapoartelor de conținut ilegal, moderare, blocare. |
| **Persoane vizate** | Reclamant (utilizator) + persoană raportată (utilizator). |
| **Categorii date — normale** | `reports`, `illegal_content_reports` (motiv, descriere, evidence URLs), `blocks`, `admin_audit_log`, `risk_flags`, `risk_signals`, `banned_fingerprints`. |
| **🟥 Categorii Art. 9** | Posibilă — dacă reclamantul citează conținut despre orientare/sănătate. Tratat ca Art. 9 prin precauție. |
| **Temei Art. 6** | 6(1)(c) obligație legală (DSA UE 2022/2065) + 6(1)(f) interes legitim (siguranță comunitate). |
| **Temei Art. 9** | 9(2)(g) interes public substanțial (siguranță online, DSA). |
| **Destinatari** | P1, P7 (AI Gateway pentru moderare text dacă activat — text scurt, fără PII suplimentar), P8. |
| **Transfer extra-UE** | P7 (dacă model US), P8 — SCC + DPF. |
| **Retenție** | 36 luni (apel + investigație autorități). |
| **Măsuri tehnice** | RLS: reclamantul vede doar propriul raport; admin via `has_role`. `admin_audit_log` imutabil. Coordonator DSA listat la `/legal/dsa`. |

---

## A8. Raportare CSAM (zero-tolerance)

| | |
|---|---|
| **Scop** | Detecție + raportare conținut de abuz sexual asupra minorilor (NCMEC + autorități penale RO). |
| **Persoane vizate** | Suspecți, victime (minori). |
| **Categorii date — normale** | `csam_reports`, `csam_hash_blocklist`, `photo_hashes` (perceptual hash). |
| **🟥 Categorii Art. 9 + protecție minori** | Conținutul în sine. Hash-uri perceptuale păstrate pentru blocare repetată. |
| **Temei Art. 6** | 6(1)(c) obligație legală (Legea 217/2003, Directivă UE 2011/93). |
| **Temei Art. 9** | 9(2)(g) interes public substanțial. |
| **Destinatari** | P1, NCMEC, autorități penale RO (operatori independenți, nu procesatori — temei legal direct). |
| **Transfer extra-UE** | NCMEC (SUA) — obligație legală, nu necesită SCC (Art. 49(1)(d) — motiv important de interes public). |
| **Retenție** | **Permanent** pentru hash-uri și raport; obligație legală. |
| **Măsuri tehnice** | Hash-uri perceptuale (pHash) — niciodată conținut brut trimis în afara P1 fără temei legal direct. |

---

## A9. SOS / siguranță utilizator

| | |
|---|---|
| **Scop** | Funcție „panic button" — alertă rapidă, fake call, ștergere rapidă a aplicației. |
| **Persoane vizate** | Utilizator în pericol + contacte de încredere (dacă listate). |
| **Categorii date — normale** | `sos_events` (timestamp, tip, locație opțională la momentul evenimentului). |
| **🟥 Categorii Art. 9** | Posibilă (context sănătate / siguranță). Tratat ca Art. 9. |
| **Temei Art. 6** | 6(1)(b) executarea contractului + 6(1)(d) **interese vitale** (protecția vieții). |
| **Temei Art. 9** | 9(2)(c) interese vitale ale persoanei vizate. |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | 12 luni (audit siguranță). |
| **Măsuri tehnice** | `src/lib/sos.functions.ts`. Quick-exit FAB. PIN lock pentru a împiedica accesul fizic. |

---

## A10. Ștergerea contului & portabilitate

| | |
|---|---|
| **Scop** | Exercitarea drepturilor Art. 15, 17, 20 GDPR. |
| **Persoane vizate** | Utilizator care își exercită drepturile. |
| **Categorii date — normale** | `deletion_requests` (timestamp, motiv opțional), export JSON cu toate datele userului. |
| **🟥 Categorii Art. 9** | Da — exportul include orientare + sănătate dacă au fost completate. |
| **Temei Art. 6** | 6(1)(c) obligație legală (GDPR). |
| **Temei Art. 9** | 9(2)(a) consimțământul inițial acoperă restituirea către persoana vizată. |
| **Destinatari** | P1, P5 RevenueCat (anulare via `cancelRevenueCatForUser`), P8. Nu trimitem la P6 (Didit) cerere de ștergere automată — necesită follow-up manual conform DPA. |
| **Transfer extra-UE** | P5, P8 — SCC + DPF. |
| **Retenție** | `deletion_requests`: 3 ani (dovadă conformitate). Restul: cascade DELETE imediat. |
| **Măsuri tehnice** | `deleteMyAccount` în `src/lib/account.functions.ts` — log → cancel RevenueCat → `auth.admin.deleteUser` (cascade) → cleanup storage. Export: `exportMyData`. |

---

## A11. Evenimente, RSVP, advertising self-serve

| | |
|---|---|
| **Scop** | Organizare evenimente comunitate; campanii sponsored banners. |
| **Persoane vizate** | Organizatori, participanți, advertiseri (business). |
| **Categorii date — normale** | `events`, `event_rsvps`, `advertisers`, `ad_campaigns`, `ad_events` (impression/click anonim). |
| **🟥 Categorii Art. 9** | Niciuna directă (poate decurge din tematica evenimentului — tratat ca Art. 9 prin context). |
| **Temei Art. 6** | 6(1)(b) executarea contractului. |
| **Temei Art. 9** | 9(2)(e) date făcute publice manifest de persoana vizată (RSVP voluntar). |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | Eveniment + 12 luni. `ad_events` 90 zile. |
| **Măsuri tehnice** | RLS pe RSVP. Nicio remarketing cross-site. |

---

## A12. Business onboarding (cont comercial)

| | |
|---|---|
| **Scop** | Verificare identitate fiscală pentru conturi business (advertiser, organizator). |
| **Persoane vizate** | Reprezentant legal business. |
| **Categorii date — normale** | `business_applications` (denumire, CUI, contact). |
| **🟥 Categorii Art. 9** | Niciuna. |
| **Temei Art. 6** | 6(1)(b) executarea contractului + 6(1)(c) obligație legală fiscală. |
| **Temei Art. 9** | N/A. |
| **Destinatari** | P1, P9 ANAF (lookup CUI public — operator independent), P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | 10 ani fiscal. |
| **Măsuri tehnice** | `src/lib/anaf.functions.ts` — trimite doar CUI, nimic personal. |

---

## A13. Consimțământ & conformitate

| | |
|---|---|
| **Scop** | Înregistrarea probatorie a consimțămintelor (Art. 7 GDPR) și a retragerii lor. |
| **Persoane vizate** | Toți utilizatorii. |
| **Categorii date — normale** | `consent_log` (kind, version, accepted, user_agent, ip_hash, timestamp), `policy_versions`, `profiles.health_data_consent_at`, `marketing_consent_at`, `terms_accepted_at`, `privacy_accepted_at`. |
| **🟥 Categorii Art. 9** | Logarea consimțământului pentru `health_data` (referință, nu valori). |
| **Temei Art. 6** | 6(1)(c) obligație legală (Art. 7(1) GDPR — sarcina probei). |
| **Temei Art. 9** | N/A (logul este metadata, nu data sensibilă). |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | Pe durata contului + **3 ani după ștergere** (probă conformitate). |
| **Măsuri tehnice** | Triggere DB: `enforce_health_consent_on_profile` blochează scrierea fără consimțământ; `cascade_health_consent_withdrawal` setează NULL la retragere. RPC `withdraw_health_consent`. |

---

## A14. Securitate, anti-fraudă, rate limit, audit admin

| | |
|---|---|
| **Scop** | Detectarea abuzurilor, prevenirea fraudei, audit operațional. |
| **Persoane vizate** | Toți utilizatorii + administratorii. |
| **Categorii date — normale** | `device_fingerprints`, `banned_fingerprints`, `rate_limit_log`, `risk_signals`, `risk_flags`, `admin_audit_log`, `admin_login_attempts`, `admin_mfa_status`, `admin_ip_allowlist`, `breach_incidents`. |
| **🟥 Categorii Art. 9** | Niciuna. |
| **Temei Art. 6** | 6(1)(f) interes legitim (securitate platformă) + 6(1)(c) (notificare breach Art. 33). |
| **Temei Art. 9** | N/A. |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | 24 luni audit log; `rate_limit_log` 30 zile; `breach_incidents` 5 ani. |
| **Măsuri tehnice** | Hash UA + IP. MFA admin obligatoriu. IP allowlist admin. `check_rate_limit` per acțiune sensibilă. |

---

## A15. Marketing direct (opțional)

| | |
|---|---|
| **Scop** | Email/push promoțional Premium, anunțuri produs. |
| **Persoane vizate** | Utilizatori care au activat marketing. |
| **Categorii date — normale** | `profiles.marketing_consent_at`, segmentare anonimizată. |
| **🟥 Categorii Art. 9** | **Niciodată** — segmentare exclusiv pe câmpuri non-Art. 9. |
| **Temei Art. 6** | 6(1)(a) consimțământ (toggle Setări). |
| **Temei Art. 9** | N/A by design. |
| **Destinatari** | P1, P4 push, P8. |
| **Transfer extra-UE** | P4, P8 — SCC + DPF. |
| **Retenție** | Cât timp consimțământul este activ + 12 luni log retragere. |
| **Măsuri tehnice** | Nicio segmentare pe orientare/sănătate. Retragere instant. |

---

## A16. Telemetry & web vitals (anonim)

| | |
|---|---|
| **Scop** | Monitorizare performanță tehnică (Core Web Vitals). |
| **Persoane vizate** | Vizitatori. |
| **Categorii date — normale** | `web_vitals` (LCP, INP, CLS, route, user-agent agregat). Pseudonim. |
| **🟥 Categorii Art. 9** | Niciuna. |
| **Temei Art. 6** | 6(1)(f) interes legitim. |
| **Temei Art. 9** | N/A. |
| **Destinatari** | P1, P8. |
| **Transfer extra-UE** | P8 — SCC + DPF. |
| **Retenție** | 90 zile. |
| **Măsuri tehnice** | Fără ID user atașat. |

---

## A17. AI features (moderare text, asistent bio, embeddings)

| | |
|---|---|
| **Scop** | Moderare automată texte; asistență la scrierea bio. |
| **Persoane vizate** | Utilizatori care folosesc feature-urile. |
| **Categorii date — normale** | Doar textul trimis explicit (bio draft, mesaj raportat). |
| **🟥 Categorii Art. 9** | **NU se trimit câmpuri Art. 9 codificate** (hiv_status, orientation). Dacă userul scrie liber un text care le conține → temei consimțământ explicit prin folosirea feature-ului. |
| **Temei Art. 6** | 6(1)(b) (asistent bio — feature opt-in) + 6(1)(f) (moderare). |
| **Temei Art. 9** | 9(2)(a) consimțământ implicit prin trimiterea voluntară a textului — **DE REZOLVAT: adaugă disclosure explicit în UI înainte de trimiterea bio-ului la AI**. |
| **Destinatari** | P7 Lovable AI Gateway, P8. |
| **Transfer extra-UE** | P7 (dacă model US), P8 — SCC + DPF. |
| **Retenție** | Nu păstrăm noi; politica Lovable AI Gateway (zero retention pentru modelele suportate). |
| **Măsuri tehnice** | `src/lib/ai.server.ts` — gateway pe server, niciodată cheie client. |

---

# Lista "DE REZOLVAT" (intrări DPIA)

Identificate la generarea acestui registru, din analiza schemei reale:

1. **🟧 A4 — selfie Didit ca date biometrice**: temeiul 9(2)(a) este înregistrat la onboarding global (`terms`/`privacy`) dar **nu** există un consent_log dedicat `age_verification` separat de termenii generali. **Acțiune:** adaugă în onboarding (`src/routes/n.tsx`) un consent explicit `kind='age_verification'` înainte de redirect către Didit.
2. **🟧 A17 — AI Gateway**: bio assist trimite text liber la model US potențial; lipsește un disclosure explicit + checkbox de consimțământ în UI-ul de bio assist. **Acțiune:** adaugă tooltip + consent la prima utilizare per user; loghează în `consent_log` kind `ai_features`.
3. **🟧 A6 — push consent dual**: consimțământul de push este browser-level (Notification API) + opt-in app-level. Lipsește înregistrare în `consent_log` (kind `push_notifications`). **Acțiune:** loghează în `consent_log` la activare/dezactivare.
4. **🟥 DPIA obligatoriu (Art. 35)**: combinația date sănătate + orientare + locație + monitorizare sistematică + risc minori impune DPIA formal. **Acțiune:** redactare DPIA + anexare la registru înainte de lansare comercială publică.
5. **🟧 TIA (Transfer Impact Assessment)** post-Schrems II pentru toți procesatorii US (P2, P3, P4, P5, P7, P8). **Acțiune:** redactare TIA și anexare.
6. **✅ Cifrare la nivel de coloană pentru `hiv_status` / `hiv_test_date` aplicată**: plaintext-ul nu mai există în `profiles`; datele sunt în `hiv_status_enc` / `hiv_test_date_enc`, accesibile doar prin RPC-urile server-side `get_user_health` / `set_user_health`. Test DB anti-regresie: `assert_no_plaintext_hiv_profile_completion()`.
7. **🟧 DPO desemnat oficial** (Art. 37) — neînregistrat. **Acțiune:** numire formală + notificare ANSPDCP.
8. **🟧 DPA Didit + RevenueCat + Lovable**: semnate manual din dashboard — confirmă starea fiecăruia și anexează copii.

---

## A18. Descoperă lângă tine (venues / events / offers)

| Câmp | Valoare |
|---|---|
| **Activitate** | Listare publică de localuri, evenimente și oferte din apropierea userului ("Aproape de tine"). |
| **Scop** | Executare contract: a oferi utilizatorului conținut local relevant (localuri queer-friendly, evenimente, promoții). |
| **Persoane vizate** | Utilizatori autentificați și anonimi (browsing). |
| **Categorii de date** | (a) Locație **aproximativă** a userului — bucket de grilă ~5 km, calculat **pe device**; serverul nu primește lat/lng exacte. (b) Coordonate publice ale venues/events/offers (date publice ale partenerilor moderate). (c) `offer_claims`: id user + cod random + timestamp (minimizare — fără PII suplimentar către partener). |
| **Categorii Art. 9** | **Nu.** Funcția nu procesează date Art. 9. Niciun consent_log dedicat necesar. |
| **Temei Art. 6** | 6(1)(b) executare contract (utilizatorul folosește feature-ul descoperire). Pentru claims: 6(1)(b) + 6(1)(f) (interes legitim al partenerului de a-și măsura promoțiile, fără a expune identitatea revendicatorului). |
| **Destinatari** | Niciun procesator nou pentru funcționalitate (totul on-device + DB internă). **Tile-uri hartă:** P10 — OpenStreetMap Foundation (UK adequacy; primește doar IP + bbox tile, fără identitate user). |
| **Transferuri extra-UE** | UK (OSM) — adequacy decision EC 2021/1772. Nu se transferă lat/lng userului către OSM (harta cere doar tile-uri pe zona vizualizată). |
| **Termen retenție** | `venues` / `offers`: indefinit cât e activ partenerul; `offer_claims`: 24 luni de la `claimed_at` (pentru audit anti-abuz), apoi anonimizate (păstrăm `count`, ștergem `user_id`). |
| **Măsuri tehnice** | (1) **Bucketizare pe device** — RPC `nearby_points(p_bucket_id)` refuză apel fără bucket valid; nu acceptă lat/lng. (2) Filtrare la rază exactă (≤2/5/10 km) **pe device**, prin Haversine. (3) Owner venue nu poate auto-publica (RLS `is_published=false` la INSERT/UPDATE owner). (4) Claim-urile sunt vizibile DOAR userului propriu (RLS) — partenerul vede agregate prin RPC `offer_stats` (count, fără identitate). (5) Hartă MapLibre + OSM raster (no API key, no SDK tracking). |

---

## A19. Notificări de proximitate (foreground + background opt-in)

| Câmp | Valoare |
|---|---|
| **Activitate** | Avertizare locală când userul se află în raza (≤2 km default) unui venue/event aprobat și publicat. Două straturi: **Strat 1** foreground (app deschis, fără permisiune de fundal); **Strat 2** background geofencing (Capacitor, opt-in explicit). |
| **Scop** | Executare contract: notificări locale relevante pentru descoperire venues/events. |
| **Persoane vizate** | Utilizatori autentificați care au activat notificările de proximitate. |
| **Categorii de date** | (a) Coordonate user — **rămân pe device**, NU pleacă la server; folosite doar pentru bucket + Haversine local. (b) `proximity_notification_log`: `user_id`, `point_id`, `point_kind`, `layer`, `sent_at` (ledger anti-spam — NU traseu). (c) Pentru Strat 2: permisiune OS background location (consent registrat ca `background_location`). |
| **Categorii Art. 9** | **Nu.** Coordonatele sunt prelucrate doar local și nu sunt stocate ca istoric. |
| **Temei Art. 6** | Strat 1: 6(1)(b) executare contract. Strat 2 (background): 6(1)(a) consimțământ explicit (`background_location`). |
| **Destinatari** | Niciun procesator nou. Refolosește P4 (push services) pentru notificări native când e cazul; pe web rămâne local (Notification API). |
| **Transferuri extra-UE** | Niciunul nou. |
| **Termen retenție** | `proximity_notification_log`: 30 zile (suficient pentru cooldown 24h + audit anti-abuz), apoi purge automat. |
| **Măsuri tehnice** | (1) **Coordonatele user NU pleacă la server** — calcul Haversine pe device peste lista bucket. (2) Gate server `try_record_proximity_hit`: cooldown 24h per (user, punct), plafon zilnic 8 notificări, ore liniștite 22:00–08:00 (configurabile în `app_settings.proximity_notifications`). (3) Doar venues/events cu `moderation_status='approved' AND is_published=true AND partner_suspended_at IS NULL` declanșează — verificat în SQL. (4) Toggle granular `profiles.proximity_notifications_enabled` (independent de push). (5) Strat 2 cere `has_active_consent(user, 'background_location')`; retragerea consimțământului blochează imediat server-gate. (6) **Niciun istoric de traseu** stocat — log-ul conține doar evenimentul "am notificat", nu poziții. (7) Refresh la mișcare semnificativă ≥250 m (`watchSignificantMovement`). |

---

# Documente conexe

- `/legal/privacy`, `/legal/terms`, `/legal/cookies`, `/legal/subprocessors`
- `/legal/dsa` (coordonator DSA)
- `/legal/security-incidents`
- `/legal/records-of-processing` (pagina publică sumarizată a acestui registru)
- `docs/migrations-draft/encrypt-hiv-columns.md`
- `AGENTS.md` — reguli permanente (locație, sănătate, procesatori, Art. 30)

## A20 — Facturare parteneri (Business)

- **Scop:** Emitere facturi proforma/fiscale către parteneri B2B (venues/events/oferte) pentru abonamente lunare și boost-uri one-off, plătite prin transfer bancar (OP) cu confirmare manuală în admin.
- **Persoane vizate:** Reprezentanți legali ai persoanelor juridice partenere (administratori, persoane de contact pentru facturare). NU se prelucrează date ale userilor finali.
- **Categorii de date:** Date business (denumire firmă, CUI, Reg.Com., adresă sediu social, IBAN partener — opțional, email facturare) + cod unic de plată generat intern. Snapshot imutabil în factură.
- **Categorii speciale (Art. 9):** NICIUNA. Date strict business.
- **Temei legal:** Art. 6(1)(b) GDPR (executare contract de servicii cu partenerul) + Art. 6(1)(c) GDPR (obligație legală de emitere documente fiscale conform Codului Fiscal RO și OUG 28/1999).
- **Destinatari:** intern (admin staff cu rol `moderator+` pentru lectură, `admin+` pentru confirmare plată); ANAF la control fiscal; contabilitate internă. **Banca NU primește date personale** — doar tranzacție B2B (IBAN, sumă, mențiune cod plată).
- **Procesatori externi:** NICIUNUL. Stocare exclusiv în Supabase (P1 — Frankfurt, UE). Niciun procesator de plată extern (Stripe / RevenueCat / Pay U etc.).
- **Transferuri extra-UE:** NU.
- **Retenție:** 10 ani de la emiterea facturii (obligație fiscală RO — Cod Fiscal art. 25, OUG 28/1999, Legea Contabilității 82/1991).
- **Măsuri tehnice:** RLS (partenerul vede DOAR facturile proprii); confirmare plată EXCLUSIV prin RPC `admin_confirm_invoice_payment` gated `is_staff` + audit log; numerotare neîntreruptă prin `next_invoice_number` (SECURITY DEFINER atomic); snapshot imutabil al datelor fiscale; preț și TVA centralizate în `app_settings.billing_settings` (versionate).
- **Drepturi vizați:** acces, rectificare (înainte de emitere; după emitere se generează factură storno), portabilitate (export CSV facturi din portal partener — TBD). Ștergerea NU se aplică din cauza obligației legale de retenție fiscală 10 ani.
