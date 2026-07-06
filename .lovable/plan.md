# Inventar admin — analiză, zero modificări

Legenda stare: 🟢 CONECTAT+FOLOSIT · 🟡 CONECTAT dar rar/parțial · 🔴 SCHELET neconectat
Legenda legal: **OBLIG** · **RECOM** · **OPȚ**

Sursă: `src/routes/admin.tsx` (~40 secțiuni internă via `section` state) + `src/routes/admin.users.$id.tsx` (9 taburi) + 29 fișiere `src/lib/admin-*.functions.ts` + 42 componente `src/components/admin/*`.

---

## A. MODERARE USERI

| Modul | Fișier(e) | Ce face (plain) | Date | Stare | Legal |
|---|---|---|---|---|---|
| Ban permanent | `admin-enterprise.functions.ts` → `adminBanUser/adminUnbanUser` | Marchează contul banat definitiv cu motiv + audit critic + MFA obligatoriu. | Profil | 🟡 (scrie `banned_at` dar `assert_account_usable` verifică `banned_until` — enforcement gap) | **OBLIG** |
| Suspend temporar | `adminSuspendUser`, RPC `moderator_suspend_user` | Blochează contul N ore. | Profil | 🟢 | **OBLIG** |
| Shadowban | `adminShadowbanUser` | Ascunde userul din feed fără să-l anunțe. | Profil | 🔴 (încearcă coloană `shadowbanned` care nu există, prinde eroarea, no-op) | **OPȚ** |
| Ban temporar v2 | `admin-enforcement.functions.ts` → `adminSetTemporaryBan` | Al treilea flow paralel de ban temp. | Profil | 🟡 (funcție reală, dar duplicat cu `adminSuspendUser`) | **OPȚ** (duplicat) |
| Strike / Warn | `adminApplyStrike`, `adminGetUserStrikes` | Adaugă avertisment cumulativ. | Profil | 🟢 (folosit în EnterpriseUser360) | **RECOM** |
| Legal hold | `adminSetLegalHold` | Marchează contul pentru păstrare probe legale. | Profil | 🟡 (rar) | **RECOM** |
| Force logout | `admin-wave1.functions.ts` → `adminForceLogout` | Invalidează toate sesiunile userului. | Auth | 🟢 | **RECOM** |
| Password reset trigger | `adminTriggerPasswordReset` | Trimite mail reset. | Auth | 🟢 | **RECOM** |
| Resend confirmare email | `adminResendConfirmationEmail` | Retrimite mail confirmare. | Auth | 🟢 | **OPȚ** |
| Change email | `admin-user360.functions.ts` → `adminChangeUserEmail` | Modifică emailul contului. | Auth | 🟢 | **RECOM** |
| Update profil admin | `adminUpdateUserProfile` | Editează manual câmpuri profil. | Profil | 🟢 | **RECOM** |
| Push unicast | `adminPushUnicast` | Trimite notificare unui singur user. | Notif | 🟢 | **OPȚ** |
| Official message | `admin-enforcement.functions.ts` → `adminSendOfficialMessage` | Trimite mesaj oficial în chat. | Mesaj | 🟢 | **RECOM** |
| Assign moderator | `adminAssignModerator` | Alocă un caz unui moderator. | Meta | 🟡 (există, dar nu e folosit în ReportsPanel) | **OPȚ** |
| Badge management | `admin-badges.functions.ts` (4 fn) | Acordă/revocă badge manual (press, ally, ngo_partner…). | Profil | 🟢 | **OPȚ** |
| Impersonation | `admin-impersonation.functions.ts` (3 fn) | Log de impersonare (funcția reală nu e activă). | Auth | 🟡 (doar log) | **RECOM** |

## B. RAPOARTE

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Reports queue | `admin.tsx` → `ReportsPanel` (line 1243), tabelul `reports` | Coadă rapoarte user→user cu ban/suspend/resolve inline. | Report + profil | 🟢 | **OBLIG** (DSA Art. 16) |
| DSA reports | `admin-enterprise.functions.ts` → `adminGetDsaReports`, `adminResolveDsa` | Coadă rapoarte de conținut ilegal (DSA). Reporter anonim. | Report | 🟢 | **OBLIG** (DSA) |
| CSAM reports | `adminGetCsamReports`, `adminAddCsamHash` | Coadă rapoarte suspiciune CSAM, cu hash-uri blocate global. Zero randare imagini. | Hash+meta | 🟢 | **OBLIG** (Art. 3 CSAM Reg.) |
| Appeals | `admin-appeals.functions.ts` (4 fn) + `AppealsPanel` | Contestații ale userilor la decizii. | Meta | 🟢 | **OBLIG** (DSA Art. 20) |

## C. ANTI-FRAUDĂ / CONTURI MULTIPLE

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Fraud clusters | `admin-intelligence.functions.ts` → `getFraudClusters` + `FraudClusterPanel` | Grupează device fingerprint ≥2 useri (posibile conturi multiple). | Fingerprint | 🟢 | **OPȚ** (interes legitim) |
| Signup throttle | `admin-signup-throttle.functions.ts` + `SignupThrottlePanel` | Detectează spike-uri înregistrări. | Meta | 🟢 | **RECOM** |
| Risk dashboard | `RiskDashboardPanel` + `admin-enterprise` alerts | Semnale de risc per user (scor). | Meta | 🟢 | **OPȚ** |
| Risk review queue | `RiskReviewQueuePanel` + RPC `risk-queue.functions` → `adminResolveRiskFlag` | Coadă alerte risc de rezolvat. | Meta | 🟢 | **OPȚ** |
| Rate limit | `admin-ratelimit.functions.ts` + `RateLimitPanel` | Vizualizează `rate_limit_log`. | Meta | 🟢 | **RECOM** |
| Security signals | `admin-security-signals.functions.ts` + `SecuritySignalsPanel` | Semnale auth (login failures, IP allowlist hits). | Auth log | 🟢 | **RECOM** |
| IP allowlist | `admin-staff.functions.ts` → `adminAdd/RemoveIpAllowlist` | IP-uri permise pentru login admin. | Meta | 🟢 | **RECOM** |

## D. DATE SENSIBILE (BREAK-GLASS)

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Break-glass reveal | `admin-break-glass.functions.ts` → `adminBreakGlassReveal` | Descoperă orientare / locație / mesaje cu justificare + MFA + audit dublu. | **Art. 9 + locație precisă + mesaje** | 🟢 | **RECOM — de declarat în DPIA** |
| Break-glass log | `adminListBreakGlass` + `admin_sensitive_access_log` | Istoric acces sensibil (vizibil super_admin + auditor). | Audit | 🟢 | **OBLIG** (dacă break-glass activ) |

## E. GDPR OPS

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Deletion requests | `admin-enterprise.functions.ts` → `adminGetDeletionRequests`, `adminProcessDeletion` | Coadă cereri Art. 17 (ștergere). | Profil | 🟢 | **OBLIG** |
| Cancel deletion | `admin-wave1.functions.ts` → `adminCancelDeletion` | Anulează cerere de ștergere. | Profil | 🟢 | **OBLIG** |
| Data export | `adminExportUserData` | Export Art. 15 (portabilitate). | Profil integral | 🟡 (apelabil de orice staff — recomand restricționat) | **OBLIG** |
| Hard purge | `adminPurgeUserAccount`, `adminRunPurgeNow` | Șterge definitiv contul + date. | Profil | 🟢 (super_admin+MFA) | **OBLIG** |
| GDPR trail | `adminGetGdprTrail` | Log acțiuni GDPR per user. | Audit | 🟢 | **OBLIG** (Art. 5(2)) |
| Consent history | `admin-user360.functions.ts` → `adminGetConsentHistory`, `adminExportConsentHistoryCsv` + `adminGetUserConsentHistory` | Istoric consimțăminte per user. | Consent | 🟢 | **OBLIG** (Art. 7(1)) |

## F. AUDIT & SECURITATE

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Audit log | `admin-enterprise.functions.ts` → `adminGetAuditLog` + `admin_audit_log` append-only | Vizualizează toate acțiunile admin. | Audit | 🟢 | **OBLIG** |
| Sensitive access log | `admin_sensitive_access_log` | Istoric break-glass (append-only). | Audit | 🟢 | **OBLIG** |
| MFA status | `adminGetMyMfa`, `adminMarkMfaEnrolled` + `admin-mfa-guard.ts` | Obligă 2FA la acțiuni distructive. | Auth | 🟢 | **OBLIG** (Art. 32) |
| Staff management | `admin-staff.functions.ts` → grant/revoke role + `StaffManagementPanel` | Alocă roluri (super_admin, moderator…). | Auth | 🟢 | **OBLIG** |
| Breach incidents | `adminGetBreaches`, `adminCreateBreach` + tabelul `breach_incidents` | Înregistrează breșe pentru notificare ANSPDCP 72h. | Meta | 🟢 | **OBLIG** (Art. 33) |
| Policy versions | `admin-policy.functions.ts` (6 fn) + `PolicyEnginePanel` + `adminGetPolicies` | Publică politici + versiuni. | Meta | 🟢 | **OBLIG** (evidența schimbărilor) |
| Legal docs | `admin-legal.functions.ts` (15 fn) + `LegalDocsAdminPanel` + `LegalP0Panel` | Gestionează Terms/Privacy/Cookies + versiuni. | Meta | 🟢 | **OBLIG** |
| Sessions log | `admin-sessions.functions.ts` (3 fn) | Vizualizează sesiunile active. | Auth | 🟢 | **RECOM** |

## G. ALERTE

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Alert engine | `admin-enterprise.functions.ts` → `adminGetAlerts`, `adminAck/Snooze/Resolve/Assign/UpdateAlert` + `admin_alerts` | Alerte generate automat de reguli (risk, spike, breach). | Meta | 🟢 | **RECOM** |
| Alert rules | `adminListAlertRules`, `adminUpsert/Delete/Toggle/SimulateAlertRule` + `AlertRulesPanel` | CRUD reguli alertă + simulator. | Meta | 🟢 | **OPȚ** |
| Affected accounts | `adminGetAlertAffectedAccounts` | Conturile atinse de o alertă. | Profil | 🟢 | **OPȚ** |

## H. ORICE ALTCEVA

| Modul | Fișier | Ce face | Date | Stare | Legal |
|---|---|---|---|---|---|
| Overview dashboard | `admin-overview.functions.ts` + `OverviewPanelRich` | Sumar operational (pending reports, SLA, etc.). | Agregat | 🟢 | **OPȚ** |
| SLA telemetry | `admin-sla-telemetry.ts` | Măsurători SLA per coadă. | Meta | 🟢 | **OPȚ** |
| System health | `SystemHealthPanel` | Ping-uri DB + edge. | Meta | 🟢 | **OPȚ** |
| Users listing | `admin-users-ops.functions.ts` (3 fn) + `EnterpriseUsersPanel` | Căutare/filtru/bulk useri. | Profil (safe) | 🟢 | **RECOM** |
| User 360 | `admin-user360.functions.ts` (7 fn) + `EnterpriseUser360Panel` | Vedere completă a unui user. | Profil | 🟢 | **RECOM** |
| Wave1 sections | `admin-wave1.functions.ts` + `Wave1Sections` | Profil mascat + acțiuni auth combinate. | Profil | 🟢 | **RECOM** |
| Timeline user | `admin-timeline.functions.ts` (1 fn) | Cronologie evenimente per user (audit + rapoarte + consent). | Agregat | 🟢 | **RECOM** |
| Support tickets | `admin-support.functions.ts` (8 fn) + `SupportTicketsPanel` | Coadă tickets user. | Support | 🟢 | **OPȚ** |
| Support macros | `admin-macros.functions.ts` (6 fn) + `SupportMacrosPanel` | Răspunsuri predefinite. | Meta | 🟢 | **OPȚ** |
| Queue claims | `admin-queue.functions.ts` (5 fn) + `useQueueClaim` | Un moderator „claim-ează" un caz pentru a evita dubluri. | Meta | 🟢 | **OPȚ** |
| Broadcast | `admin-broadcast.functions.ts` (3 fn) + `BroadcastV2Panel` | Trimite notificare masivă (necesită consimțământ push). | Notif | 🟢 | **OPȚ** |
| Content ops | `admin-content.functions.ts` (3 fn) + `AdminToolsPanel` | Șterge/moderează conținut punctual. | Content | 🟢 | **RECOM** |
| Partners moderation | `admin-partners.functions.ts` (9 fn) + `PartnersModerationPanel` | Aprobă/suspendă parteneri B2B + venues/events/offers. | Business | 🟢 | **RECOM** |
| Billing | `admin-partners` + `BillingAdminPanel` | Confirmă plăți OP parteneri. | Business | 🟢 | **RECOM** |
| Boost calendar | `PartnerBoostCalendarPanel` | Sloturi boost partener pe oraș/zi. | Business | 🟢 | **OPȚ** |
| Intelligence | `admin-intelligence.functions.ts` (11 fn) + `IntelligenceDashboardPanel` | Revenue, retention, funnel, push health, experiments, kill-switches, min-version. | Agregat | 🟢 | **OPȚ** |
| Experiments | `ExperimentsPanel` + `getExperimentResults` | A/B tests. | Agregat | 🟢 | **OPȚ** |
| Kill switches | `KillSwitchesPanel` + `getKillSwitches` | Dezactivare feature-uri global. | Config | 🟢 | **RECOM** |
| Min version | `getMinVersion`, `setMinVersion` | Force-update app. | Config | 🟡 (client nu-l consumă încă) | **RECOM** |
| Push health | `PushHealthPanel` + `getPushHealth` | Rate livrare push. | Agregat | 🟢 | **OPȚ** |
| Fraud panel | `FraudClusterPanel` (vezi C) | | | | |
| Settings & flags | `admin-settings.functions.ts` (6 fn) + `SettingsAndFlagsPanel` | `app_settings` + `feature_flags` editor. | Config | 🟢 | **OBLIG** (versionare) |
| Data explorer | `admin.functions.ts` → `adminListTables/Rows/UpdateRow/DeleteRow/InsertRow` | Editor generic pentru orice tabel din whitelist. | Variabil | 🟡 (nu loghează READ) | **OPȚ** (risc dacă e lăsat larg) |
| Demo seed | `DemoSeedPanel` + `demo-seed.functions` | Populează date demo (`is_seed=true`). | Meta | 🟢 (gate super_admin, ascuns în prod) | **OPȚ** |
| AI copilot | `admin-ai.functions.ts` (1 fn) + `AiCopilotPanel` | Sumar/decizie via Lovable AI pentru context admin. | Prompt intern | 🟡 (activ, dar prompt neaudit) | **OPȚ** |
| Verification queue (18+) | `admin-verification.functions.ts` (6 fn) + `VerificationQueuePanel` | Coadă internă selfie 18+. | Selfie | 🔴 **DEPRECATED** (Didit e sursa unică; comentariu explicit `DEPRECATED` în fișier) | **OPȚ** |
| Admin profanity mask | `admin-profanity.ts` | Utility maskare cuvinte în UI. | — | 🟢 | **OPȚ** |
| Overview command palette | `CommandPaletteV2` | Cmd+K search în admin. | — | 🟢 | **OPȚ** |
| Saved views | `SavedViewsBar` | Vederi salvate în tabele. | — | 🟢 | **OPȚ** |
| Reason dialog | `ReasonDialog` | Prompt motiv acțiune (reused). | — | 🟢 | **OPȚ** |
| Panel status / error banner / auto-refresh | `PanelStatus`, `AdminErrorBanner`, `AutoRefreshSelect` | Utility UI, reused în multe panouri. | — | 🟢 | **OPȚ** |

---

## CANDIDAȚI LA ȘTERGERE (cod mort real, non-legal)

Aplic filtrele: 🔴 SCHELET NEconectat SAU 🟡 duplicat funcțional AND legal ≠ OBLIG.

### 1. `adminShadowbanUser` — **ȘTERGERE SIGURĂ**
- **Fișier:** `src/lib/admin-enterprise.functions.ts` (linia 201)
- **Stare reală:** face `UPDATE profiles SET shadowbanned=...` — coloana nu există, prinde eroarea, no-op.
- **Consumatori:** verificat — **nu e importat/apelat în niciun UI**. Doar exportat, mort la runtime.
- **Legal:** OPȚ.
- **Recomandare:** șterge funcția + curăță referințele în audit log dacă există.

### 2. `admin-verification.functions.ts` + `VerificationQueuePanel.tsx` — **PĂSTREAZĂ dormant, NU șterge**
- **Fișier:** `src/lib/admin-verification.functions.ts` (6 fn) + `src/components/admin/VerificationQueuePanel.tsx`.
- **Stare:** montat în `admin.tsx` la `section === "verifqueue"`, marcat explicit `DEPRECATED` în comentar.
- **De ce NU șterge:** este schelet dormant conservat intenționat conform REGULĂ AGE GATE ("rămâne ca schelet dormant… reactivabil dacă business-ul decide"). Regula spune să nu-l activezi, dar și să nu-l ștergi.
- **Recomandare:** păstrat. Poți ascunde item-ul din nav dacă vrei UI curat.

### 3. `adminSetTemporaryBan` (admin-enforcement) — **duplicat, șterge după consolidare**
- **Fișier:** `src/lib/admin-enforcement.functions.ts` (linia 72)
- **Stare:** funcțional, dar duplicat cu `adminSuspendUser` din enterprise. Ambele scriu `suspended_until`.
- **Consumatori:** verificat — apelat doar în `EnterpriseUser360Panel` (împreună cu strikes, ca parte din pachet). Poate fi înlocuit cu `adminSuspendUser`.
- **Legal:** OPȚ (funcționalitate acoperită deja).
- **Recomandare:** consolidare într-o singură funcție (nu ștergere directă — trebuie mutat call site-ul întâi).

### 4. `adminAssignModerator` — **candidat curățenie**
- **Fișier:** `src/lib/admin-enforcement.functions.ts` (linia 114)
- **Stare:** definit, dar `ReportsPanel` nu-l apelează (asignarea rapoartelor e neconectată în UI).
- **Consumatori:** verificat — 0 call sites.
- **Legal:** OPȚ.
- **Recomandare:** ori conectează-l la Reports (feature util pentru echipă), ori șterge.

### 5. `admin-impersonation.functions.ts` (3 fn) — **doar log activ**
- **Stare:** funcțiile logează în `admin_impersonation_log`, dar impersonarea reală (session hijack) nu e implementată. Rămâne infrastructura pentru viitor.
- **Consumatori:** apelat din `OperationsUserOpsPanel`, dar UI-ul afișează doar log (view-only).
- **Legal:** RECOM (audit-ul e util). 
- **Recomandare:** păstrat ca infrastructură audit; ștergere = risc mic dacă nu planifici feature-ul.

### 6. `getMinVersion / setMinVersion` — **schelet backend fără gate client**
- **Fișier:** `src/lib/admin-intelligence.functions.ts` (linia 117/131)
- **Stare:** funcție backend + UI editor, dar clientul mobil/web nu blochează pe versiune (per TODO din memory).
- **Consumatori:** UI există (`admin.tsx` section min-version). Backend gata; client-side gate lipsește.
- **Legal:** RECOM. **NU șterge** — completează.

---

## Rezumat concret

- **Un singur candidat curat la ștergere azi:** `adminShadowbanUser` (mort la runtime, 0 call sites, non-legal).
- **Duplicat funcțional:** `adminSetTemporaryBan` — consolidează în `adminSuspendUser`.
- **Neconectat dar util:** `adminAssignModerator` — conectează sau șterge.
- **Restul „pare inutil": PĂSTREAZĂ.** Cvasi-total codul admin este fie folosit direct în UI, fie e schelet legal (CSAM/DSA/GDPR/audit/breach) care trebuie să existe indiferent de trafic, fie e schelet dormant declarat intenționat (verificare internă).

Zero modificări făcute. Aștept decizia ce vrei să curățăm.
