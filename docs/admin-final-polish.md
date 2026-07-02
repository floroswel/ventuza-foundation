# Admin — Final Polish Audit (real, per-panel)

Sursă: scanare `src/components/admin/*` + `src/routes/admin.tsx` (1846 LOC) +
`src/lib/admin-*.functions.ts`. Fiecare item este verificabil, are efect
observabil în UI/ops și respectă REGULĂ — ADMIN PANELS (loading/error/empty)
și REGULĂ — ADMIN (RBAC + audit + MFA + break-glass).

Nu conține "1000 de îmbunătățiri". Conține ce lipsește real, pe fiecare panou,
în ordine de execuție. Executăm val cu val, fără confirmări între ele.

---

## VAL 1 — Loading/Error/Empty conform REGULĂ ADMIN PANELS

Panouri care nu au încă cele trei stări distincte cu `AdminPanelError` +
"empty legitim" separat de eroare:

- [x] `AlertRulesPanel` — pe eroare afișează banner + suprimă empty ambiguu.
- [x] `ExperimentsPanel` — refactorizat pe `useAdminPanelLoad` + `PanelStatus`,
      diferențiază "zero experimente" de "forbidden".
- [x] `LegalDocsAdminPanel` — banner "Acces refuzat" cu hint `super_admin`
      pentru non-super_admin.
- [x] `PolicyEnginePanel` — empty legitim explicit ("Creează prima regulă").
- [x] `RateLimitPanel` — deja pe `useAdminPanelLoad` + `PanelStatus`.
- [x] `SignupThrottlePanel` — deja pe `useAdminPanelLoad` + `PanelStatus`.
- [x] `SystemHealthPanel` — try/catch fatal + banner "Reîncearcă".
- [x] `DemoSeedPanel` — "Populează" dezactivat în producție (wipe rămâne activ).
- [x] `SecuritySignalsPanel` — deja pe `useAdminPanelLoad` + `PanelStatus`.

Fix pattern: `useAdminPanelState` (hook nou) care returnează
`{ loading, error, empty, reload }` și un `<AdminPanelBoundary>` wrapper.

## VAL 2 — SLA + Claims pe toate cozile

Panouri operaționale care nu au încă `<SlaBadge>` + `<ClaimBadge>`:

- [ ] `AppealsPanel` — DSA cere SLA 24h; nu se vede warning/breach.
- [ ] `FeedbackInbox` — fără claim, doi operatori intră peste același item.
- [ ] `PartnersModerationPanel` — cozi venue/event/offer fără SLA vizibil.
- [ ] `LegalP0Panel` (NCMEC, GDPR breach) — SLA legal 72h GDPR nu e afișat.
- [ ] `RiskReviewQueuePanel` — lipsă claim.

## VAL 3 — SavedViews + BulkActions consistente

Panouri cu liste unde bara e absentă:

- [ ] `AppealsPanel`
- [ ] `PartnersModerationPanel`
- [ ] `SupportTicketsPanel` — are Bulk, nu are SavedViews.
- [ ] `EnterpriseUsersPanel` — are ambele, dar nu persistă între taburi.
- [ ] `RiskReviewQueuePanel`

## VAL 4 — Audit trail vizibil în panou (nu doar în DB)

Fiecare panou care mută stare trebuie să afișeze ultimele 5 acțiuni ale
operatorului curent, cu diff before/after (drawer lateral).

- [ ] `SettingsAndFlagsPanel` — schimbări flag/app_setting fără istoric UI.
- [ ] `StaffManagementPanel` — grant/revoke rol fără mini-timeline.
- [ ] `BillingAdminPanel` — confirm plată fără history inline.
- [ ] `KillSwitchesPanel` — cine a activat/dezactivat, când, de ce.

## VAL 5 — Break-glass UX pe date sensibile

- [ ] `EnterpriseUsersPanel` → drawer "Reveal sensitive" cu dropdown
      `kind ∈ {health, location, selfie, messages, orientation}` +
      justificare min 20 caractere + confirmare MFA. Astăzi există RPC dar
      nu e apelat din UI userului 360.
- [ ] `PartnersModerationPanel` → break-glass pe date KYC (CUI/IBAN) ascunse
      by default, revelate cu justificare.

## VAL 6 — MFA guard pe restul funcțiilor distructive

`assertAdminMfa` deja acoperă ban/unban/suspend/grant/revoke/break-glass/
purge. Lipsesc:

- [ ] `adminUpsertFlag` — flip flag de producție fără MFA.
- [ ] `adminUpdateSetting` — schimbare `billing_settings` fără MFA.
- [ ] `adminConfirmInvoicePayment` — activare abonament fără MFA.
- [ ] `adminModerateItem` (approve venue > 5km rază notificări) — MFA.
- [ ] `adminEscalateCsam` — escaladare NCMEC fără MFA (critic!).
- [ ] `adminKillSwitchToggle` — global kill fără MFA.

## VAL 7 — Empty state cu next-action

Fiecare "empty legitim" trebuie să spună **ce să facă operatorul**, nu doar
"nimic aici":

- [ ] "Nicio cerere GDPR în așteptare" → link "Vezi cereri închise (30z)".
- [ ] "Nicio breșă activă" → link "Rulează exercițiu simulare".
- [ ] "Zero rapoarte CSAM" → link "Verifică hash-uri blocate global".
- [ ] "Zero apeluri DSA" → link "Verifică rapoarte respinse recent".

## VAL 8 — Keyboard shortcuts documentate

`useKeyboardShortcuts` există. Nu există UI care le listează.

- [ ] Modal "?" (Shift+/) cu toate shortcut-urile per panou curent.
- [ ] Palette v2 include tab "Shortcuts".

## VAL 9 — Exporturi CSV pe TOATE listele

Panouri fără export CSV (cu masking aplicat conform SENSITIVE_COLUMNS):

- [ ] `AppealsPanel`
- [ ] `FeedbackInbox`
- [ ] `PartnersModerationPanel`
- [ ] `SupportTicketsPanel` — există pe useri, nu pe tickete.
- [ ] `BillingAdminPanel` — facturi/plăți.
- [ ] `LegalP0Panel` — export NCMEC/GDPR queue.

## VAL 10 — Overview real-time refresh

`OverviewPanelRich` refresh manual. Adaugă:

- [ ] Auto-refresh 30s (respectă `AutoRefreshSelect`).
- [ ] Diff verde/roșu per KPI vs. valoarea anterioară afișată.
- [ ] Badge "Live" cu heartbeat vizual.

---

## Panouri care sunt OK azi (nu necesită intervenție)

- `OperationsUserOpsPanel` — respect complet REGULĂ.
- `CommandPaletteV2` — funcțional, are fuzzy search.
- `AdminToolsPanel` — no-op stateless.
- `AiCopilotPanel` — read-only, fără mutații.
- `BroadcastV2Panel` — are guard MFA + confirm.
- `IntelligenceDashboardPanel` — read-only.
- `Wave1Sections` / `EnterpriseSections` — meta-containere.
- `PanelStatus` — primitive.

---

## Ordine execuție (fără confirmări)

1. VAL 1 (loading/error/empty) — cel mai critic pentru "spinner etern".
2. VAL 6 (MFA guard) — deficit de securitate.
3. VAL 2 (SLA/claims) — impact operațional imediat.
4. VAL 4 (audit vizibil) — încredere operator.
5. VAL 5 (break-glass UX).
6. VAL 3 (SavedViews/Bulk).
7. VAL 7 (empty next-action).
8. VAL 9 (export CSV).
9. VAL 10 (overview live).
10. VAL 8 (shortcuts modal).

Fiecare val = un commit atomic, verificat cu `tsgo` + preview.
