# Audit ADMIN Ventuza — ce lipsește, fără politically correct

Ultima trecere: 2026-07-01. Scop: listăm brutal ce e gol, ce e "UI fără spate",
ce e "spate fără UI", ce lipsește complet față de admin-urile din top (Grindr,
Tinder, Bumble, Hinge, Match Group, Feeld, Scruff). Nu netezim nimic.

Legendă severitate:
- 🔴 P0 = blocker legal / risc de imagine / risc de bani
- 🟠 P1 = operațional zilnic, ne costă timp / vinovății
- 🟡 P2 = "nice to have enterprise", competitorii au, noi nu

Cu ✅ = există și e conectat. Cu ⚠️ = există parțial. Cu ❌ = lipsește complet.

---

## 0. Fundație (RBAC, MFA, audit, secrete)

- ✅ RBAC 6 roluri, `has_role`/`is_staff`/`is_admin_or_above` server-side.
- ✅ `admin_audit_log` append-only, trigger anti-mutation.
- ✅ Break-glass cu justificare + `admin_sensitive_access_log`.
- ✅ MFA guard pe acțiunile distructive (`assertAdminMfa`).
- ⚠️ **MFA enrollment UI**: statusul se citește, dar nu există flow "cere-mi să înrolez TOTP acum" în admin. Userul admin nou nu are un ghid pas-cu-pas. 🟠 P1
- ❌ **IP allowlist real enforcement**: tabelul `admin_ip_allowlist` există, dar nu am middleware server-fn care să respingă apeluri din IP nelistate. 🔴 P0 (dacă vrei enterprise real).
- ❌ **Session timeout / re-auth pe acțiuni sensibile** (step-up auth la break-glass, ban, ștergere). Astăzi break-glass cere doar justificare + MFA enrolled, nu re-verificare TOTP la fiecare acțiune. 🔴 P0.
- ❌ **Rotire cheie `HEALTH_COL_KEY`** — script/RPC de re-cifrare batched cu cheie nouă. Astăzi cheia e statică. 🟠 P1.
- ❌ **Rotire secrete UI** (view "Secrete server" cu ultima rotire, next-due). Rulează prin dashboard, dar admin-ul nostru nu-l vede. 🟡 P2.
- ❌ **Rate-limit per admin** (protecție contra unui cont admin compromis care începe să scoată bulk PII). 🔴 P0.

---

## 1. Overview / Alerts / Copilot

- ✅ OverviewPanel cu KPI.
- ⚠️ Alerts: există `admin_alerts` dar nu are: acknowledgment cu SLA, escalation policy, on-call rotation, integrare Slack/Discord/webhook. 🟠 P1.
- ❌ **Runbook per alertă** (link către procedura de răspuns). 🟡 P2.
- ⚠️ AiCopilot: expune AI, dar nu are: quota per operator, log per prompt în audit, refuz automat pe PII. 🟠 P1.

---

## 2. Users (management + User360)

- ✅ Listing + User360 detaliat + ban/suspend/grant role cu MFA + audit.
- ❌ **Merge accounts** (fuzionare duplicate — email + phone rec). Support real cere asta zilnic. 🟠 P1.
- ❌ **Force logout + rotate refresh token** dintr-un click. Există `adminRevokeSessions` dar nu e legat la User360 ca buton primar. 🟠 P1.
- ❌ **Rescheduling delete** (userul a cerut ștergere, dar admin-ul vrea să întârzie 24h pentru anti-regret). Astăzi e binar. 🟡 P2.
- ❌ **Anonimizare parțială** (păstrează statistici agregate, șterge PII) — GDPR "restrict processing" Art. 18. Astăzi facem doar erase total. 🔴 P0 legal.
- ❌ **Note interne pe user** persistente (case notes cu autor + timestamp). 🟠 P1.
- ❌ **Cronologie unificată** (login-uri + rapoarte + ban-uri + break-glass + tickete) într-un singur timeline. User360 le arată pe cartonașe separate. 🟠 P1.
- ❌ **Export dosar user** ca PDF/JSON semnat (pentru cereri Art. 15 tratate manual, sau DPA). 🟠 P1.
- ❌ **Shadow ban / rate-limit interactivitate** (nu ban complet, ci "mesajele lui nu ajung la nimeni nou"). Toate app-urile mari au. 🔴 P0 anti-abuse.
- ❌ **Verify override** (marcheaz-un user "verified" fără Didit, cu motiv). Utile la creator/celeb. 🟡 P2.
- ❌ **Reset PIN privat album** din admin (user și-a uitat PIN). 🟡 P2.

---

## 3. Reports / Moderation

- ✅ ReportsPanel + acțiuni ban/suspend.
- ❌ **Coadă cu prioritizare** (SLA per severitate, first-response time, aging bucket). Astăzi = listă cronologică. 🟠 P1.
- ❌ **Bulk actions** (aprobă/respinge N rapoarte simultan, atribuie moderator). 🟠 P1.
- ❌ **Categorii standard DSA** (harassment, hate, nudity minor, spam, impersonation, self-harm) cu template de răspuns. 🔴 P0 DSA Art. 17.
- ❌ **Motivare structurată către reporter + către subiectul reportat** (SoR — Statement of Reasons, mandatoriu DSA). Există `appeals` dar nu SoR outbound. 🔴 P0 DSA.
- ❌ **Assign to moderator** + workload dashboard per moderator. 🟠 P1.
- ❌ **Auto-triage AI** (clasificare + suggestion) cu fallback obligatoriu la human review pe categorii sensibile. 🟠 P1.
- ❌ **Rapoarte "pieces of content" vs "user"** — separat. Astăzi confundate. 🟠 P1.

---

## 4. CSAM

- ✅ Blocklist perceptual + sha256, no-render, escalate.
- ❌ **Integrare NCMEC / IWF / INHOPE cybertip API** — trimitere automată cu hash + metadata către autoritate. Astăzi = manual. 🔴 P0 legal (US law + UK IWF).
- ❌ **Chain of custody export** (fișier semnat crypto pentru anchetatori). 🔴 P0 legal.
- ❌ **PhotoDNA / SafeSearch / Thorn integration** — matching împotriva hash-urilor globale la upload. Astăzi doar blocklist local. 🔴 P0.
- ❌ **Age-estimation model pe poze profil** (semnal, nu decizie) — flag manual review dacă < 25. Toate app-urile serioase îl au. 🔴 P0.
- ❌ **Retention forensic** (păstrare hash + metadata 90 zile pentru anchete active chiar dacă userul șterge). 🔴 P0 legal.

---

## 5. DSA / Appeals

- ✅ AppealsPanel + illegal_content_reports anonim.
- ❌ **Transparency report generator** — DSA Art. 15 impune raport anual public: număr ordine autorități, decizii moderare, mediana timp de răspuns. Nu avem UI care să exporte. 🔴 P0 DSA.
- ❌ **Statement of Reasons submitter to EU Commission DSA database** (obligatoriu pentru VLOPs; noi nu suntem VLOP acum, dar dacă ajungem >45M UE = P0). 🟡 P2 azi.
- ❌ **Trusted flagger channel** (Art. 22) — cont separat cu prioritate. 🟠 P1.
- ❌ **Notice-and-action deadline tracker** (24h manifest illegal, 7z alte cazuri). 🔴 P0 DSA.
- ❌ **Autoritate publică — order handling** (Art. 9 / 10 DSA) — UI dedicat pentru ordine de la ANCOM / DIICOT cu deadline legal + confirmation of receipt. 🔴 P0.

---

## 6. GDPR Ops

- ✅ Export + erase manual, break-glass logat.
- ❌ **SLA countdown** (Art. 12 impune 30 zile de la cerere; +60 zile extindere doar cu motivare). Nicăieri afișat. 🔴 P0.
- ❌ **Cereri Art. 16 (rectificare), 18 (restricționare), 21 (opoziție)** — astăzi avem doar erase + export. Restul se fac ad-hoc → risc necontrolat. 🔴 P0.
- ❌ **Portabilitate reală (Art. 20)** — format machine-readable structurat (JSON schema publicat), nu doar dump. 🟠 P1.
- ❌ **Verificare identitate solicitant** înainte de erase (contra pretexting attack). Astăzi = admin decide "el e cine spune". 🔴 P0.
- ❌ **Registru cereri cu status + comunicare towards user** din admin (email out cu template + audit). 🟠 P1.
- ❌ **DPIA workflow** (evaluare impact) pentru feature nou care atinge Art. 9. 🟡 P2.

---

## 7. Break-Glass

- ✅ Log + roles per kind.
- ❌ **Notificare live** (Slack/email către DPO + un alt super_admin) la fiecare break-glass. Astăzi doar log passive. 🔴 P0.
- ❌ **4-eyes rule** — dezvăluire selfie/mesaje să ceară aprobarea unui al doilea admin înainte de decrypt. 🔴 P0.
- ❌ **Auto-expire access** (fereastră 15 min, apoi re-motivare). Astăzi = un click, o decriptare, gata. 🔴 P0.
- ❌ **Recording of session** (ce a văzut admin-ul concret, nu doar "kind=messages"). 🟠 P1.

---

## 8. Breach Incidents

- ✅ Tabela + panou.
- ❌ **72h notification wizard** către ANSPDCP + subiecți vizați (Art. 33/34). Cu template + risk assessment. 🔴 P0.
- ❌ **Categorization by severity** (funcție + UI). 🟠 P1.
- ❌ **Post-mortem template** atașat incidentului. 🟡 P2.

---

## 9. Policies

- ✅ Versionare politici.
- ❌ **Diff viewer** între versiuni. 🟠 P1.
- ❌ **Trigger re-consent** pe schimbare materială (bulk notification + gate soft până la re-acceptare). Există `consent_log` dar nu automation UI. 🔴 P0 GDPR.
- ❌ **Localizare EN/RO/EL/HU** — o singură versiune azi. Publicăm în UE, ar trebui minim EN. 🟠 P1.

---

## 10. Audit Log

- ✅ Append-only + read.
- ❌ **Filtrare + căutare full-text** peste `before/after JSONB`. 🟠 P1.
- ❌ **Export CSV/JSON semnat** pentru audit extern. 🟠 P1.
- ❌ **Retention policy** (astăzi = infinit; ar trebui 2 ani standard + break-glass 6 ani legal). 🟠 P1.
- ❌ **Alertă anomalii** (super_admin acționează la 03:00 din IP nou → notify). 🔴 P0.
- ❌ **SIEM export** (Datadog / Splunk / ELK). 🟡 P2.

---

## 11. Ads / B2B / Partners / Billing

- ✅ Moderation + billing manual + entitlements.
- ❌ **Revenue dashboard real** (MRR/ARR/churn PER PLAN, LTV, CAC — există doar în IntelligenceDashboard superficial). 🟠 P1.
- ❌ **Dunning management** — remindere automate configurate; azi = manual. 🟠 P1.
- ❌ **Credit note / stornare** cu numerotare proprie. Astăzi ai `admin_void_invoice`, dar fără emitere credit note. 🔴 P0 fiscal RO.
- ❌ **e-Factura ANAF integration** (obligatoriu B2B RO din 2024). 🔴 P0 legal.
- ❌ **SAF-T export** anual pentru ANAF. 🔴 P0 legal.
- ❌ **Boost calendar / inventory** — vezi TODO Faza 2 (deja notat).
- ❌ **Partner NPS / feedback loop** din admin. 🟡 P2.
- ❌ **Contract e-signature** pentru DPA + T&C parteneri. 🟠 P1.
- ❌ **Impersonate partner** (view-as pentru debug). Există pentru user, nu pentru partener. 🟠 P1.

---

## 12. Data Explorer

- ⚠️ Există, dar:
- ❌ **Query saved** + share cu alt admin. 🟡 P2.
- ❌ **Export CSV limitat** — trebuie plafon + audit pe cine a exportat ce coloane. 🔴 P0 (exfiltrare risk).
- ❌ **Column-level PII masking automat** pe rezultate (astăzi masking manual în UI la anumite tabele). 🔴 P0.
- ❌ **Read-only enforcement server-side** — să nu poată executa DELETE/UPDATE nici accidental. 🔴 P0.

---

## 13. Broadcast v2

- ✅ Targeting + dry-run.
- ❌ **A/B test integrat** pe subject/body cu winner auto-promote. 🟠 P1.
- ❌ **Frequency cap per user** (max 2 broadcast-uri / săptămână) — protecție contra spam. 🔴 P0 (unsubscribe rate).
- ❌ **Unsubscribe center** granular per canal (email vs push vs in-app). 🔴 P0 GDPR/ePrivacy.
- ❌ **Template library** cu variabile reutilizabile. 🟡 P2.
- ❌ **Scheduled + timezone-aware send**. 🟠 P1.
- ❌ **Bounce/complaint handling** dashboard (email deliverability). 🟠 P1.

---

## 14. Intelligence

- ✅ MRR/ARR/churn/retention/funnel bazic.
- ❌ **Cohortă D1/D7/D30 defalcată** — deja pe TODO.
- ❌ **Real-time dashboard** (WebSocket / polling agresiv) pentru DAU acum. 🟡 P2.
- ❌ **North-star metric definit + tracked** (ex: "conversații active pe user pe săptămână"). 🟠 P1.
- ❌ **Segmentare custom** (build-your-own segment cu filtre). 🟠 P1.
- ❌ **Funnels multi-step configurabili** (astăzi = hardcodat). 🟠 P1.
- ❌ **Anomaly detection** (drop DAU 20% → alertă). 🟠 P1.
- ❌ **City heatmap** — foarte util pe dating: unde recrutăm activ, unde stagnăm. 🟠 P1.

---

## 15. Kill switches / Version gate

- ✅ Toggle module + force update.
- ❌ **Feature flag rollout % per cohort** (canary 5% → 25% → 100%). Astăzi = ON/OFF. 🟠 P1.
- ❌ **Kill switch cu razuire audit** (cine a apăsat, când, motiv → există audit generic, dar nu confirmare "reason" pe kill switch). 🟠 P1.
- ❌ **Rollback plan / auto-revert la spike de erori**. 🟡 P2.
- ❌ **Version gate per țară / A/B** (Play Store staged rollout aliniat). 🟡 P2.

---

## 16. Support / Appeals

- ✅ Ticketing intern + appeals DSA.
- ❌ **Canale intake multiple** (email → ticket auto, in-app form → ticket). Astăzi doar creat manual. 🔴 P0 (utilizatorii nu au unde să scrie).
- ❌ **SLA per severitate + escalation**. 🟠 P1.
- ❌ **Macros / canned responses**. 🟠 P1.
- ❌ **CSAT survey** post-rezolvare. 🟠 P1.
- ❌ **Auto-suggest response din AI** cu review. 🟡 P2.
- ❌ **Knowledge base publică** consumată din ticketing (deflection). 🟠 P1.
- ❌ **Priority pentru useri premium**. 🟡 P2.

---

## 17. Risc / Fraud / Anti-abuse

- ✅ Risk dashboard + queue + Turnstile + rate limit + signup throttle.
- ❌ **Device fingerprint clustering** (cross-account detection). Există date, nu există UI. 🔴 P0.
- ❌ **Velocity rules configurabile din UI** (astăzi hardcodat). 🟠 P1.
- ❌ **IP intelligence** (VPN/TOR/datacenter/geo mismatch) — integrare IPQS / MaxMind. 🔴 P0.
- ❌ **Face-match verificare vs poze profil** (Didit face-only vs photo library) — anti-catfishing serios. 🟠 P1.
- ❌ **Behavior scoring** (message-to-match ratio, time-to-first-message, block rate) → risk score compus. 🟠 P1.
- ❌ **Honeypot profiles** pentru detectare scam-bots. 🟡 P2 dar foarte eficient.
- ❌ **Payment fraud** (chargeback tracker) — la parteneri. 🟠 P1.

---

## 18. Trust & Safety specific dating gay

- ❌ **Blackmail / sextortion runbook + panic button** vizibil în admin. 🔴 P0 (nișă vulnerabilă).
- ❌ **Outing risk detector** — mesaje care conțin threats + PII (adresă/loc muncă) → alertă. 🔴 P0.
- ❌ **Country risk mode** — dacă userul e într-un JAILING COUNTRY (77 țări penalizează homosexualitatea), UI-ul admin trebuie să: refuze să-i arate locația precisă, forțeze stealth by default, refuze cooperare cu autoritățile locale. Grindr, Hornet au. Noi nu. 🔴 P0.
- ❌ **HIV-status disclosure alerts** — mesaj care conține "HIV+" / "poz" / "neg" fără consimțământ documentat → warn. Etică + legal (unele jurisdicții criminalizează non-disclosure). 🟠 P1.
- ❌ **Chem-sex flag** (drugs slang detection) → HR flow spre outreach ARAS/harm-reduction, nu direct ban. 🟠 P1.

---

## 19. Content / Media moderation

- ✅ Upload validation + moderation queue.
- ❌ **Nudity classifier** (SafeSearch / Hive / Sightengine) obligatoriu pe upload public. Astăzi ai AI moderation, dar nu văd că e legată de scor NSFW. 🔴 P0 Play Store.
- ❌ **Face detection minimă 1 face** pe primary profile pic (anti-anonim + anti-object). 🟠 P1.
- ❌ **EXIF strip audit** — să confirmăm că se face pe TOATE uploadurile (nu doar profile). 🔴 P0 (locație GPS în EXIF).
- ❌ **Signed URL expiry per bucket** — verificare că nu există URL-uri permanente pe private albums. 🔴 P0.
- ❌ **Reverse-image search** (identifică poze furate / scam). 🟠 P1.

---

## 20. Notificări (proximity + push)

- ✅ Gate central `try_record_proximity_hit`.
- ❌ **Dashboard livrare FCM/APNS per campanie** — TODO Faza 2.
- ❌ **Bounce/token cleanup automat** (tokens invalide 30z → șterge). 🟠 P1.
- ❌ **Test send la self din admin** pentru fiecare template. 🟡 P2.

---

## 21. Localizare / i18n

- ❌ **UI admin doar RO**. Pentru staff internațional / auditor UE = blocaj. 🟠 P1.
- ❌ **i18n content management** — string-uri în DB cu editor + fallback. Astăzi hardcodat. 🟡 P2.

---

## 22. Observabilitate / Health

- ✅ SystemHealth basic + slow queries + edge logs (prin tool).
- ❌ **Error tracking client (Sentry-like)** integrat în admin cu link direct la stack + user. 🔴 P0.
- ❌ **APM traces** (server fn latency P50/P95/P99). 🟠 P1.
- ❌ **Cost dashboard** (AI gateway spend / user, storage / user, DB rows). 🔴 P0 (unit economics).
- ❌ **Backup status + restore drill schedule** — să confirmăm că backup-urile Cloud sunt testate. 🔴 P0.

---

## 23. Public transparency

- ❌ **Trust page publică** — /trust cu: număr rapoarte tratate luna trecută, mediană răspuns, appeals reversed rate. Bumble/Hinge au. 🟠 P1.
- ❌ **Status page** (uptime.ventuza.eu). 🟠 P1.

---

## 24. Ce e "spate fără UI" astăzi (funcții server care nu sunt expuse)

- `adminUpdateBillingSettings` — există RPC, dar SettingsAndFlagsPanel nu are secțiune dedicată "Billing settings" cu preview + versionare vizibilă.
- `admin_ip_allowlist` — tabelă goală, fără UI de admin.
- `admin_login_attempts` — tabelă populată (probabil), fără dashboard.
- `admin_mfa_status` — status citit, dar fără UI de enrollment / reset MFA per staff.
- `csam_hash_blocklist` — există, dar fără UI de curatorship (adaugă/scoate hash manual, cu justificare + sursă).
- `photo_hashes` — există, fără UI de căutare "cine mai are hash-ul X".
- `experiment_events` — există logging, dar UI Experiments nu arată graful evenimentelor per bucket.
- `web_vitals` — colectăm CLS/LCP/INP, dar admin nu are dashboard.
- `feedback` — există FeedbackInbox, ok, dar fără taggare / assign.

---

## 25. Ce e "UI fără spate serios" astăzi

- `RiskDashboardPanel` — arată scoruri, dar reguli de scoring nu sunt tunable din UI.
- `BroadcastPanel` (v1 vechi) — încă în cod alături de v2, ar trebui șters ca să nu confuzeze.
- `AnalyticsPanel` — depinde de un serviciu extern? Verifică; dacă nu, e placeholder.

---

## 26. Ce fac ceilalți și noi NU

| Feature | Grindr | Tinder | Bumble | Hinge | Feeld | Scruff | Ventuza |
|---|---|---|---|---|---|---|---|
| Trusted flagger channel | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| Country-risk stealth auto | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ | ❌ |
| NCMEC auto-report | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Photo age-estimation | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Shadow ban | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Face-match anti-catfish | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| Public transparency report | ✅ (Grindr Unwrapped) | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| e-Factura ANAF (RO local) | n/a | n/a | n/a | n/a | n/a | n/a | ❌ (obligatoriu la noi) |
| SoR DSA outbound | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| 4-eyes on PII decrypt | ✅ (Grindr post-2023 fine) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 27. TOP 10 priorități imediate (fără politically correct)

1. 🔴 **NCMEC/IWF auto-report + PhotoDNA la upload.** Fără ăsta, un singur incident CSAM = închidere Google Play + Apple + investigație. Non-negociabil.
2. 🔴 **e-Factura ANAF + credit notes.** Deja ilegal să facturezi B2B fără din 2024. Prima control ANAF = amendă + suspendare CIF.
3. 🔴 **Country-risk mode + outing detector + sextortion runbook.** Suntem app gay. Un user mort în Uganda/Egipt/UAE pentru că am servit locația precisă = New York Times + proces colectiv + brand distrus.
4. 🔴 **DSA SoR + notice-and-action deadline tracker + Trusted Flagger.** Comisia UE trimite ordine reale acum. Fără evidența, amendă până la 6% cifra afaceri globală.
5. 🔴 **Shadow ban + face-match anti-catfish.** Toate app-urile de dating au. Fără = scam-ul devine viral, App Store rating <2.
6. 🔴 **4-eyes rule + step-up MFA + auto-expire pe break-glass.** Un admin compromis = leak Art. 9 = ANSPDCP + presă.
7. 🔴 **72h breach wizard + notify pipeline.** GDPR Art. 33 e ceas.
8. 🔴 **Nudity classifier + EXIF strip audit + signed URL expiry.** Play Store nu iartă nude pe primary photo. EXIF cu GPS = outing accidental.
9. 🔴 **Frequency cap broadcast + unsubscribe center granular.** Fără = spam complaints → domain blacklist → email dead.
10. 🔴 **Verify identity pe erasure request + anonimizare parțială Art. 18.** Pretexting attack = un atacator șterge conturi reale.

---

## 28. TOP 10 priorități "operațional zilnic" (P1)

1. 🟠 Bulk actions + assign moderator în Reports.
2. 🟠 SLA countdown + status GDPR cases.
3. 🟠 Case notes persistente pe user.
4. 🟠 Timeline unificată user.
5. 🟠 Alerts anomalii audit log (super_admin la 3AM din IP nou).
6. 🟠 Device fingerprint clustering UI.
7. 🟠 City heatmap intelligence.
8. 🟠 Support intake channels (email → ticket).
9. 🟠 Feature flag rollout %.
10. 🟠 UI admin EN pe lângă RO.

---

## 29. Ce recomand să atacăm în valuri (dacă spui "atacă")

**Val 3 — Legal survival (P0, non-negociabil):**
NCMEC/PhotoDNA + e-Factura + Breach wizard + DSA SoR/deadline + Country-risk mode.

**Val 4 — Anti-abuse serios (P0 competitiv):**
Shadow ban + face-match + IP intel + 4-eyes break-glass + step-up MFA + nudity classifier + EXIF audit.

**Val 5 — Ops enterprise (P1):**
Bulk moderation + SLA + case notes + timeline + clustering + heatmap + support intake + flag rollout %.

**Val 6 — Transparență + polish (P1/P2):**
Trust page publică + i18n admin + APM/Sentry + cost dashboard + status page + backup drills.
