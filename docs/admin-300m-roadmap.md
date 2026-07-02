# Admin $300M — Roadmap onest (fără PC)

Scope cerut: aduce **toate** cele ~30 de panouri din `/admin` la paritate cu ce
au Grindr / Bumble / Tinder / Hinge / Match Group intern. Estimare realistă:
**6–10 sprinturi** (val = 3–5 panouri, un turn = un val parțial). Nu se face
într-un singur turn — cine promite altceva minte.

## Panouri în scop (30)

Alerts · AI Copilot · Broadcast · Broadcast V2 · Support Ticketing · DSA Appeals ·
User Ops · Intelligence (MRR/Churn/Funnel) · Trust & Safety · Users (Enterprise) ·
Reports · Risk Queue · Risk Review · Risk Dashboard · CSAM · DSA SoR · GDPR Ops ·
Break-Glass · Breach Wizard · Legal P0 (NCMEC/DSA) · Policy Engine (rules) ·
Audit Log · Legal Docs CMS · Business Ads · B2B Billing · Partners Moderation ·
Partner Invoices · System Health · Kill-Switches · Feature Flags / Settings.

## Ce lipsește global (aplicabil pe toate)

1. **Alert Rules Engine** — reguli custom (event → prag → severitate → destinatar).
2. **Assignment & SLA per entitate** — owner, due_at, escalation ladder, paging.
3. **Bulk actions universale** pe fiecare listă (checkbox → toolbar sticky).
4. **Saved Views** pe fiecare listă + share intra-team.
5. **CSV / JSONL export** pe orice listă cu limite server-side + audit.
6. **Deep-linking** între panouri (alerta → user360 → risc → tickete → audit).
7. **Playbooks / Macros** — acțiuni compuse re-rulabile (ex: "Ban+Purge+SoR").
8. **Approvals workflow** (dual-control pe acțiuni distructive: super_admin #2 approve).
9. **Diff viewer** pe fiecare modificare admin (before/after JSON pretty).
10. **Notes / Comments** per entitate (user, ticket, apel, factură).
11. **Tagging system** universal (etichete cu culori, filtrare).
12. **Search unificat** (Cmd+K → toate entitățile, nu doar useri).
13. **Metrics per panel** (SLA compliance, backlog age, worker throughput).
14. **Ops presence** (cine e online, cine lucrează ce).
15. **Locale / i18n admin** (RO/EN toggle, timezone per operator).

## Wave plan

### Val 1 — Alerts complete (acest sprint)
- `alert_rules` (event pattern, threshold, window, severity, destination, enabled).
- `admin_alerts.assigned_to` + `due_at` + `priority` + `escalated_at` + `parent_id`.
- Rules CRUD UI (creare/edit/test cu backtest 24h).
- Assign / Reassign / Take.
- SLA badge + escalation la depășire (auto-crește severity).
- Bulk ack/snooze/resolve cu ReasonDialog.
- Saved views + CSV export.
- Playbooks presetate ("Escalate to CSAM", "Open ticket", "Notify DPO").

### Val 2 — Ticketing + Appeals + User Ops
- Ticketing: macros, canned responses, CSAT, merge/split, priorități SLA.
- DSA Appeals: SLA legal 6 luni, statement of reasons cross-link, batch review.
- User Ops: bulk actions (ban/suspend/verify/tag), impersonate cu justificare.

### Val 3 — Trust & Safety + Risk (Queue/Review/Dashboard) + CSAM
- Risk playbooks, model versioning, backtest, feedback loop.
- CSAM: NCMEC live queue, PhotoDNA fallback, chain-of-custody.

### Val 4 — Intelligence + Broadcast v2 + Ads
- MRR waterfall, cohorte D1/D7/D30, funnel drop-off, LTV/CAC.
- Broadcast: A/B split, segment builder vizual, quiet hours per țară, throttle.
- Ads: creative library, CTR/CPM, moderare pre-live.

### Val 5 — B2B / Facturi / Parteneri
- Dunning automation, credit notes, refund workflow.
- Partner scorecard, health signals, churn prediction.
- Boost calendar cu conflict detection.

### Val 6 — Legal (DSA, NCMEC, Docs CMS, Break-Glass, Breach, Policy Engine)
- Policy Engine: shadow→enforce cu diff live, rollback, approval dual.
- Docs CMS: workflow draft→review→publish + diff versiuni.
- Break-Glass: pager-duty style, 15 min TTL, video-recording session.
- Breach Wizard: countdown 72h, template ANSPDCP + Art. 34.

### Val 7 — System / Settings / Kill-Switches / Flags
- Feature flags per segment (%, cohortă, țară), gradual rollout.
- Force-update version gate per platformă.
- Config-as-code cu Git-like diff/rollback pe `app_settings`.
- Data Explorer read-only cu row-level masking automat.

### Val 8 — Cross-cutting (Search, Notes, Tags, Presence, Playbooks, Approvals)
- Cmd+K global entity search (users, tickets, invoices, alerts, docs).
- Sistem note/comentarii pe orice entitate cu @mentions.
- Tagging + Saved Views universal.
- Presence (cine e online) + activity feed per operator.
- Dual-control approvals pe acțiuni critice.

## Reguli de execuție

- Fiecare val: migrație SQL (dacă e cazul) → server fns → UI → audit log → test.
- Fiecare acțiune nouă: `assertAdmin/assertStaff` + `assertAdminMfa` pe destructive + `logAudit`.
- Fiecare listă nouă: skeleton loader, error banner, empty state distinct.
- Fiecare buton distructiv: `ReasonDialog` (justificare ≥10 char).
- Zero hardcode: praguri/limite/costuri → `app_settings`.
- Zero PII în CSV export fără flag `include_pii=true` + audit critical.
