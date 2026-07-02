# Admin Audit — Contra-argumentat, fără political correct

**Data:** 2026-07-02
**Metodă:** Pentru fiecare tab existent joc rolurile: (1) CEO care vrea 10× peste competiție, (2) CISO paranoic, (3) DPO GDPR/Art. 9, (4) Moderator senior care lucrează 8h/zi în admin, (5) Trust & Safety Lead post-incident, (6) CFO care vrea unit economics, (7) SRE care e de gardă la 3AM, (8) Product Manager care măsoară timp-per-decizie.
**Ipoteză:** actualul admin este "bun" — dar NU "cel mai avansat din lume". Mai jos exact ce lipsește, per tab, fără menajamente.

Legendă severitate: 🔴 blocker enterprise · 🟠 gap serios · 🟡 polish · 🟢 nice-to-have vizionar.

---

## 0. Cross-cutting (aplicabil TUTUROR tab-urilor)

1. 🔴 **Nu există SLA vizibil pe niciun tab.** Un moderator nu știe "care e vechimea celui mai vechi item în coadă". Adaugă badge "oldest pending: 4h 12m" pe toate cozile (reports, appeals, csam, dsa, breach, partners, support, gdpr, riskqueue).
2. 🔴 **Nu există "assign to me" / "claim" pe cozi.** Doi moderatori pot deschide același raport. Enterprise: soft-lock 10min pe row cu heartbeat.
3. 🔴 **Nu există bulk actions** decât în Wave1 tabel generic. Reports/appeals/dsa/csam/support nu au bulk approve/deny/escalate.
4. 🔴 **Nu există saved views per operator.** Fiecare deschide tab-ul cu filtrele default. Enterprise are "My queue", "High risk RO", "Under 18 suspects".
5. 🔴 **Nu există keyboard shortcuts** dincolo de Cmd+K. Un mod senior face 200 decizii/zi — trebuie J/K navigation, A=approve, D=deny, E=escalate, ⇧R=reason picker.
6. 🔴 **Nu există undo pe acțiuni reversibile** (ban, suspend, hide). 5s toast cu "Undo" — reduce erorile umane cu ~30%.
7. 🟠 **Loading skeletons inconsistente.** Unele tab-uri au shimmer, altele spinner, altele blank. Standardizează prin `<PanelSkeleton rows=n />`.
8. 🟠 **Empty states nu sugerează acțiuni.** "Nicio cerere" ar trebui să spună "Ultima procesată acum 3h. [Vezi istoric]".
9. 🟠 **Erorile arată stack trace-uri crude sau mesaje SQL** (`ERRCODE 42501`). Traduce în copy human ("Nu ai rolul necesar: super_admin").
10. 🟠 **Nu există "why am I seeing this?"** pe niciun rând. Enterprise arată "matched rule: age_verification.failed_selfie".
11. 🟠 **Impersonation nu are watermark vizual** pe tot chrome-ul aplicației când e activă. Doar banner top e ușor de uitat.
12. 🟠 **Audit log nu are diff view.** Vezi before/after ca JSON crud. Trebuie side-by-side cu highlight.
13. 🟠 **Nu există export CSV/JSON per tab.** Auditorii externi cer date offline.
14. 🟠 **Nu există search global cross-entity** ("caută 'ionpop@'": arată users + reports + tickets + invoices).
15. 🟡 **Timezone hardcodat browser.** Enterprise: toggle UTC / Europe/Bucharest / user local.
16. 🟡 **Nu există dark/light toggle în admin.** Un mod care lucrează noaptea vrea AMOLED black.
17. 🟡 **Nu există compact/comfortable density toggle.**
18. 🟡 **Nu există "notes on user"** shared între moderatori (staff-only, audit-scris).
19. 🟢 **Nu există AI summary** pe user 360 ("acest user a fost raportat 3× în 30 zile pentru mesaje agresive, are risk_score 78, ultima verificare vârstă acum 2 zile — recomand shadow-ban 7 zile").
20. 🟢 **Nu există "second reviewer required"** pentru acțiuni cu impact mare (ban >100 useri, ștergere hard). 4-eyes principle.

---

## 1. Overview 🔴🔴🔴

1. Doar 4-6 KPI-uri statice. Enterprise: 20-30, personalizabile drag & drop.
2. Fără sparklines / 7d trend pe fiecare KPI.
3. Fără comparație D/D, W/W, M/M cu % variație.
4. Fără segment (RO vs restul, iOS vs Android, free vs premium).
5. Fără "goals": target MAU, target MRR, actual vs target.
6. Fără anomaly detection ("signups în RO −38% față de media 7d").
7. Fără hot incidents feed (topul evenimentelor din ultima oră).
8. Fără "on-call" widget: cine e de gardă, ce ticket-uri open critical.
9. Fără mini funnel signup → onboarding → primul mesaj → D7.
10. Fără harta lumii cu useri activi acum.
11. Fără status system (auth up? push up? DB latency? edge OK?).
12. Fără "revenue today" în RON și EUR side by side.
13. Fără push la mobile pentru KPI critical drop.
14. Fără widget "queue depth": reports X, appeals Y, csam Z.
15. Fără "moderatori online acum" cu presence.

## 2. Alerts 🔴

1. Nu există severitate configurabilă per tip alert.
2. Nu există acknowledge + auto-escalate dacă nu se ia în 15min.
3. Nu integrează cu Slack/Discord/Telegram/PagerDuty.
4. Nu se poate crea alertă custom din UI ("dacă MRR scade >10% zi/zi").
5. Nu există snooze/mute pe alertă recurentă falsă.
6. Nu există post-mortem link atașat alertei.
7. Fără audio ping pentru critical (opt-in).
8. Fără grupare alerte identice ("×47 la fel în ultima oră").

## 3. Copilot AI 🟠

1. Nu are context automatic (userul deschis, tab-ul curent).
2. Nu poate executa acțiuni ("banează userul X" cu confirm dublu).
3. Nu are model selector (fast vs deep).
4. Fără citation la surse (RLS policy #X, audit row #Y).
5. Fără istoric conversații per operator, cu tag-uri.
6. Nu propune SQL pentru data explorer.
7. Nu face RCA automat pe incidente.
8. Nu redactează Statement of Reasons DSA la cerere.

## 4. Users 🔴

1. Search doar exact — fără fuzzy (typo tolerant).
2. Fără filtre combinate salvate (RO + age<19 + risk>60).
3. Fără segment builder vizual.
4. Fără mass action gated by 4-eyes.
5. Fără column picker.
6. Fără preview inline (hover → mini profile card).
7. Fără indicator "impersonated last by X 2h ago".
8. Fără sort pe risk_score, last_seen, revenue.
9. Fără link direct la conversații (după break-glass).
10. Fără "similar users" (fingerprint / IP / email pattern).

## 5. User 360 🟠

1. Nu arată timeline unificat (audit + reports + tickets + payments + moderation events).
2. Fără graph relații (matches, blocks, reports făcute vs primite).
3. Fără scoring explicat ("risk 78 = 40 velocity + 20 device + 18 reports").
4. Fără compare-with (side-by-side cu alt user suspect duplicat).
5. Fără quick actions row (ban, suspend, reset password, force logout, wipe photos, revoke sessions).
6. Fără notes shared.
7. Fără "next best action" AI.
8. Fără preview mesaje agregate (topic clustering) fără break-glass.
9. Fără export "user data package" pentru GDPR SAR direct din UI.
10. Fără "risk over time" chart.

## 6. Reports (user-generated) 🔴

1. Fără triaj automat pe categorie + severitate.
2. Fără duplicate detection ("acest user a fost raportat de 12 alții pt același mesaj").
3. Fără preview mesaj/foto raportată INLINE (via break-glass gated).
4. Fără shortcut la reporter's history.
5. Fără reason picker standardizat pentru decizie.
6. Fără link auto la Statement of Reasons DSA generat.
7. Fără metric "median time to decision".
8. Fără "false report" flag pe reporteri abuzivi.

## 7. Risk & 8. Risk Dashboard & 9. Risk Queue 🟠

1. Trei tab-uri separate → confuzie. Consolidează în unul cu sub-view.
2. Fără drill-down device → cluster de conturi.
3. Fără graf network (edges = shared IP/device).
4. Fără backtest: "câți din scoring 80+ au ajuns banned în 30d?".
5. Fără threshold tuning UI (slider live + shadow).
6. Fără ML explainability (SHAP-like per user).
7. Fără cohort "signup burst" auto-flag.

## 10. CSAM 🔴

1. Fără integrare NCMEC directă (doar coadă locală). Ilegal în SUA după 24h.
2. Fără PhotoDNA/Safer.io fingerprint la upload.
3. Fără auto-report la NCMEC cu re-review de om înainte.
4. Fără chain-of-custody log criptografic (hash-chain).
5. Fără metric "time to report" (SLA 24h legal).
6. Fără "similar hashes" grouping.
7. Fără redirect automat user raportat spre resurse (Stop It Now, INHOPE).
8. Fără dashboard "false positive rate".

## 11. DSA 🔴

1. Fără publicare automată SoR pe transparency portal EC.
2. Fără template-uri de motivare pre-scrise.
3. Fără traduceri automate în limba destinatarului (Art. 17 DSA).
4. Fără metric "median SoR turnaround" (obligatoriu în raportul anual).
5. Fără linkare bidirecțională report ↔ appeal ↔ SoR ↔ audit.
6. Fără export raport transparență semestrial ready-to-file.

## 12. GDPR Ops 🔴

1. Fără scheduler: SAR trebuie răspuns în 30 zile — countdown vizibil.
2. Fără template DPA response.
3. Fără "data map" per user (unde sunt datele lui: DB, storage, backups, analytics, procesatori terți).
4. Fără trigger la procesatori (Didit, AI, push) pentru erasure downstream.
5. Fără verificare identitate cerută înainte de SAR (evită data leak).
6. Fără istoric SAR + status (pending/completed/refused cu motiv).
7. Fără log "cine a văzut datele exportate" (double-audit).

## 13. Break-glass 🔴

1. Fără cerere → aprobare 4-eyes pentru `health` și `orientation`.
2. Fără expirare automată a viewer session (default 5min).
3. Fără redactare parțială (arată doar câmpul cerut, nu tot).
4. Fără notificare la owner ("datele tale au fost accesate de staff pt investigație #X" — opt-out în UE, mandatory în CA).
5. Fără metric "break-glass per lună per operator" cu alertă la spike.
6. Fără justification templating (dropdown de motive predefinite + free text).

## 14. Breach (Art. 33/34) 🟠

1. Wizardul e ok dar nu are countdown 72h vizibil în timp real.
2. Fără template automat email către useri afectați (Art. 34).
3. Fără linkare la ANSPDCP form notificare oficială.
4. Fără classifier severitate (">500 useri → categorie A").
5. Fără post-incident PIR (post-incident review) template.

## 15. Policies (Policy Engine) 🟠

1. Fără versionare cu diff vizual între versiuni.
2. Fără shadow ↔ enforce cu split traffic (5% enforce, 95% shadow).
3. Fără expresii built-in avansate (regex, geo, time-window).
4. Fără test unitar per regulă cu fixtures.
5. Fără rulebook export/import JSON.
6. Fără audit "cine a schimbat regula X".

## 16. Audit log 🟠

1. Fără search full-text în before/after JSON.
2. Fără filtrare pe severity + actor + target + dată combinat.
3. Fără sesiune replay (grupare pe actor+time-window).
4. Fără hash-chain / Merkle tree pentru dovadă imutabilitate în instanță.
5. Fără export semnat criptografic pentru auditori externi.
6. Fără retenție configurabilă per tip (unele 7 ani legal, altele 30 zile).

## 17. Ads 🟠

1. Fără pacing / frequency cap per user.
2. Fără A/B pe creative.
3. Fără brand safety filters.
4. Fără estimator CPM.
5. Fără preview mobile/desktop.
6. Fără scheduling (start/end date + dayparting).

## 18. Business (biz) 🟠

1. Fără workflow multi-stage (submitted → docs verified → interview → approved).
2. Fără KYB automat (verificare CUI la ANAF).
3. Fără scoring risc partener.
4. Fără document viewer inline (contract, CI reprezentant).

## 19. Data Explorer 🔴

1. Fără query builder vizual (doar SQL raw).
2. Fără histori queries per operator.
3. Fără save & share query.
4. Fără limit auto (LIMIT 1000 forțat).
5. Fără warning pe query care scanează >1M rows.
6. Fără mask automat pe coloane sensibile chiar și pentru super_admin fără break-glass.
7. Fără export cu filigran audit ("exported by X at Y for reason Z").

## 20. Broadcast (v1 + v2) 🟠

1. Fără segment builder cu preview count înainte de send.
2. Fără A/B pe subject + copy.
3. Fără schedule + timezone-aware delivery.
4. Fără frequency cap global.
5. Fără preview per canal (push/in-app/email).
6. Fără opt-out enforcement vizibil (câți useri excluși pentru opt-out).
7. Fără metric CTR + unsubscribe rate + complaint rate.
8. Fără approval workflow (draft → review → send).

## 21. Partners moderation 🟠

1. Fără preview lightbox pe media inclusă.
2. Fără bulk approve pentru partener trusted.
3. Fără scoring auto pe risc conținut (AI text + image).
4. Fără notă istoric ("acest partener a avut 3 items respinse ultimele 30 zile").
5. Fără SLA countdown 48h.

## 22. Billing (partener) 🟠

1. Fără dunning workflow (T-3, T-0, T+3, T+7 remindere).
2. Fără reconciliation import extras bancă (CSV/MT940).
3. Fără forecasting cash-flow B2B.
4. Fără dashboard "DSO" (days sales outstanding).
5. Fără e-Factura status per invoice (queued/sent/accepted/rejected ANAF).
6. Fără storno flow cu numerotare separată.
7. Fără proforme.

## 23. Security 🟠

1. Fără MFA enforcement dashboard (câți staff fără MFA).
2. Fără IP allowlist UI (există tabel, nu UI).
3. Fără session listing global cu revoke.
4. Fără login attempts anomaly detection.
5. Fără hardware key (WebAuthn) support.

## 24. Demo seed 🟢

1. Fără dry-run preview.
2. Fără seed scenarios (mic/mediu/mare, cu incidente demo).
3. Fără reset atomic.

## 25. System Health 🟠

1. Fără SLO/SLI dashboard cu error budget.
2. Fără trace linking (deep-link în APM).
3. Fără DB slow queries + top locks.
4. Fără edge functions cold start metrics.
5. Fără storage bucket usage + quota alert.

## 26. Rate limit 🟡

1. Fără UI de reset per user (există RPC).
2. Fără vizualizare "top rate-limited endpoints".
3. Fără config threshold din UI (hardcodat în DB).

## 27. Signup throttle 🟡

1. Fără vizualizare geografică (harta signup burst).
2. Fără regulă "block ASN X pt 24h" din UI.
3. Fără email domain blacklist manager.

## 28. Settings & Flags 🟠

1. Fără search în lista de flag-uri.
2. Fără history/diff per flag.
3. Fără scheduling flag ("enable la 2026-08-01 09:00 Europe/Bucharest").
4. Fără rollback one-click.
5. Fără dependencies între flag-uri (flag A necesită B on).
6. Fără segment targeting (flag on doar pt beta users).

## 29. Staff Management 🟠

1. Fără workflow invite → accept → onboard.
2. Fără offboarding automat (revoke roluri + sessions + audit).
3. Fără permission matrix vizual (rol × acțiune).
4. Fără "just-in-time role" (elevate 1h cu justificare).
5. Fără vacation mode (auto-suspend rol în perioada X).

## 30. Admin Tools 🟡

1. Grab bag — trebuie clasificat pe verticale.
2. Fără categorii + search.
3. Fără "recently used".

## 31. Security Signals 🟠

1. Fără corelație cross-signal (impossible travel + new device + failed MFA).
2. Fără scoring per signal cu contribuție la risk total.
3. Fără playbook auto (signal X → acțiune Y).

## 32. Support Tickets 🔴

1. Fără canned responses / macros.
2. Fără merge tickets duplicate.
3. Fără CSAT survey după rezolvare.
4. Fără SLA per tier (free vs premium).
5. Fără escalation automat.
6. Fără AI draft reply.
7. Fără translation inline.
8. Fără atașamente + preview.
9. Fără linking la user 360.

## 33. Appeals (DSA) 🟠

1. Fără deadline countdown (6 luni Art. 20).
2. Fără second-reviewer forțat (nu același mod care a decis original).
3. Fără template motivare decizie.
4. Fără stats "% appeals accepted" per moderator (calibrare).

## 34. User Ops (impersonation, sessions, revoke) 🔴

1. Impersonation fără time-box automat (5min hard max).
2. Fără redactare vizuală pt PII în timpul impersonation.
3. Fără "impersonation transcript" — tot ce s-a făcut, click by click.
4. Fără notificare user post-factum (unde e permis legal).
5. Session revoke fără preview device (city, IP, last active).
6. Fără "revoke all sessions except this device".

## 35. Broadcast v2 — vezi §20.

## 36. Intelligence (MRR/Churn/Funnel) 🔴

1. Fără cohort analysis vizual.
2. Fără CAC/LTV.
3. Fără churn reason coding (exit surveys).
4. Fără NRR/GRR (net/gross revenue retention).
5. Fără forecasting (ARIMA / Prophet).
6. Fără segment: RO vs EU vs restul.
7. Fără compare cu period anterior overlay.

## 37. Kill Switches 🟠

1. Fără blast radius simulator ("dacă închid discover, X% useri afectați").
2. Fără schedule (deschide la 09:00, închide la 03:00).
3. Fără approval 2-persons pentru switch-uri critice.
4. Fără audit "cât timp a stat OFF".
5. Fără test-mode (activate doar pt 1% traffic).

## 38. Legal P0 🟠

1. NCMEC report — fără template PDF exportabil.
2. Breach wizard — fără atașamente evidence.
3. Country risk — fără preview "cum vede userul din țara X aplicația".
4. e-Factura — fără retry automat cu backoff pt ANAF down.

## 39. Policy Engine — vezi §15.

---

## Ce lipsește COMPLET (nu există niciun tab)

1. 🔴 **Trust Center public** (uptime, incidente, DPA download self-serve).
2. 🔴 **Vendor risk register** (Didit, AI, push, hosting — SOC2, ISO, DPA status).
3. 🔴 **Data retention dashboard** (câte rânduri > politica, auto-purge status).
4. 🔴 **Backup & restore drill** (last successful restore test, RPO/RTO).
5. 🔴 **Runbooks in-app** (playbook per tip incident, linkat la kill switches).
6. 🔴 **Chaos / GameDay scheduler** (test-uri programate de failover).
7. 🔴 **Fraud rings dashboard** (grafuri de conturi legate).
8. 🔴 **Content policy versioning** (community guidelines cu diff public).
9. 🔴 **Age assurance dashboard** (Didit conversion, failure reasons, cost/verificare).
10. 🟠 **Payment reconciliation** (bancă vs partner_invoices vs subscriptions).
11. 🟠 **Legal hold** (freeze date la un user pt litigiu — nu se șterg).
12. 🟠 **Regulator inbox** (ANSPDCP, ANCOM, EC Digital Services queries tracker).
13. 🟠 **Press / crisis comms** (template + workflow aprobare).
14. 🟠 **Localization admin** (traduceri per limbă, missing keys, per-region policies).
15. 🟠 **A/B experiment governance** (guardrail metrics, auto-stop pe regresie).
16. 🟠 **Cost dashboard** (Supabase egress, storage, AI tokens, push volume — cost/user activ).
17. 🟠 **Rate limit per API key** (dacă expunem API partenerilor).
18. 🟢 **Voice-of-customer** (agregare feedback + NPS + app store reviews).
19. 🟢 **Competitor watch** (screenshot semnal automat la schimbări Grindr/Scruff).
20. 🟢 **On-call rota + escalation matrix** integrat cu killswitches.

---

## Top 20 acțiuni imediate (ROI ridicat, efort mic-mediu)

1. Claim/lock pe cozi + SLA badge.
2. Bulk actions + column picker + saved views (generic, refolosibil).
3. Keyboard shortcuts J/K + A/D/E + Shift+R reason picker.
4. Undo toast 5s pe acțiuni reversibile.
5. Diff view în audit log.
6. Search global cross-entity în Cmd+K.
7. Impersonation time-box + watermark + transcript.
8. Break-glass 4-eyes pt health/orientation.
9. Hash-chain în audit log (dovadă instanță).
10. Countdown 72h Breach + template email Art. 34.
11. Countdown 30d GDPR SAR + data map per user.
12. NCMEC auto-report cu human-in-the-loop.
13. Second reviewer forțat pe appeals.
14. Dunning workflow B2B billing.
15. Killswitch blast radius + approval 2-persons.
16. Flags: history + schedule + rollback.
17. Staff MFA enforcement dashboard.
18. Cost dashboard (Supabase + AI + push).
19. Data retention dashboard + auto-purge status.
20. Runbooks in-app link în alerts + killswitches.

---

## Verdict brutal

Adminul curent = ~**"top 15% dating apps"**. Bun, dar NU "cel mai avansat din lume".

Ca să treci la "top 1%", următoarele sprint-uri obligatorii, în ordine:

- **Sprint A (Ops):** claim/SLA/bulk/shortcuts/undo/saved views — 1 săptămână.
- **Sprint B (Legal survival++):** NCMEC integration reală, hash-chain audit, 4-eyes break-glass, countdowns — 1-2 săptămâni.
- **Sprint C (Intelligence):** cohorts, LTV/CAC, forecasting, cost dashboard — 1 săptămână.
- **Sprint D (Enterprise theatre):** trust center public, vendor register, retention dashboard, runbooks in-app — 1 săptămână.
- **Sprint E (Scale-up):** chaos testing, blast radius, on-call rota, backup drills — 1 săptămână.

După aceste 5 sprint-uri (~5-6 săptămâni), adminul depășește Grindr/Scruff/Hinge la nivel operațional și legal.
