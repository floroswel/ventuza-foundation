# Harta REALĂ a panoului admin (analiză, zero modificări)

## A. Structura admin

**Rute** (doar 2 rute fizice):
- `src/routes/admin.tsx` (1963 linii) — shell + secțiuni interne comutate prin state (`section`): overview, users, reports, risk, appeals, csam, dsa, gdpr, breaches, audit, breakglass, staff, mfa, ip-allowlist, alerts, rules, ai-copilot, policy, macros, tickets, ads, b2b, partners, boost-calendar, push-health, fraud, experiments, kill-switches, min-version, settings, flags, data-explorer, demo-seed, verification-queue, timeline, intelligence, signup-throttle, rate-limit, security-signals, sla, wave1, legal-p0, broadcast-v2 (~40 secțiuni).
- `src/routes/admin.users.$id.tsx` (1383 linii) — User 360, cu 9 taburi.

**Taburi User 360**: `overview` · `enterprise` · `auth` · `consents` · `reports` · `payments` · `risk` · `gdpr` · `breakglass`.

**Fișiere `src/lib/admin-*.functions.ts`**: 31 fișiere, ~150 server functions (ban, badge, break-glass, enterprise, wave1, user360, users-ops, staff, MFA, intelligence, enforcement, appeals, broadcast, content, impersonation, legal, macros, overview, partners, policy, queue, ratelimit, security-signals, sessions, settings, signup-throttle, sla, support, timeline, verification, profanity).

## B. Ce FUNCȚIONEAZĂ vs SCHELET vs LIPSĂ

### BAN / SUSPEND
| Item | Stare | Detalii |
|---|---|---|
| `adminBanUser` (enterprise.functions) | EXISTĂ+FUNCȚIONEAZĂ parțial | Scrie `banned_at + banned_reason`. Audit + MFA. **BUG:** `assert_account_usable()` verifică doar `banned_until`, NU `banned_at` → user rămâne activ dacă are sesiune. |
| `adminUnbanUser` | EXISTĂ+FUNCȚIONEAZĂ | Șterge `banned_at`. |
| `adminSuspendUser` | EXISTĂ+FUNCȚIONEAZĂ parțial | Scrie `suspended_until`. **Nu e verificat** în `assert_account_usable`. |
| `adminShadowbanUser` | SCHELET | Încearcă `profiles.shadowbanned` — coloană inexistentă, prinde eroarea și continuă (no-op). |
| RPC `moderator_ban_user` (folosit în ReportsPanel) | EXISTĂ+FUNCȚIONEAZĂ | Setează `banned_at + suspended_until = now()+100 years`. Truc: enforce-ul se face pe altă cale (nu prin gate-ul central). |
| RPC `moderator_suspend_user` (ReportsPanel) | EXISTĂ+FUNCȚIONEAZĂ | Setează `suspended_until`. Nu e verificat de `assert_account_usable`. |
| `adminSetTemporaryBan` (enforcement.functions) | EXISTĂ | Al treilea flux paralel de ban temporar. |
| **Ban permanent enforced la login** | LIPSĂ EFECTIVĂ | `assert_account_usable` verifică doar `banned_until`; nici o funcție UI nu-l populează. |

**3 sisteme de ban coexistă** (adminBanUser vs adminSetTemporaryBan vs moderator_ban_user), fiecare atinge alt câmp.

### BADGE / VERIFICARE
| Item | Stare | Detalii |
|---|---|---|
| Tabel `badge_registry` | EXISTĂ+FUNCȚIONEAZĂ | 16 badge-uri, 6 manuale: `beta_tester`, `ally`, `press`, `event_organizer`, `bar_verified`, `ngo_partner`, `moderator_public`, `founder_ventuza`. |
| `adminListManualBadges` / `adminGrantBadge` / `adminRevokeBadge` | EXISTĂ+FUNCȚIONEAZĂ | Server fn complete. |
| UI acordare badge în User 360 (tab enterprise) | EXISTĂ+FUNCȚIONEAZĂ | Dialog "Acordă badge" în `EnterpriseUser360Panel.tsx` cu Select din catalog + revoke. |
| Badge "verified 18+" (`verified`) | EXISTĂ | Auto (ridicat de flow Didit). |
| Verificare manuală de admin (bypass Didit, ex. "verificat presă") | ACOPERIT prin badge-uri manuale (`press`, `ngo_partner`, etc.), NU prin `age_status`. |

### ETICHETE ONG/BAR/CLUB/PARTENER
| Item | Stare |
|---|---|
| Enum `app_role` include `partner`, `business` | EXISTĂ |
| Badge-uri `ngo_partner`, `bar_verified`, `event_organizer`, `press` | EXISTĂ (target=`user`) |
| Coloană `profiles.account_type` sau `labels` | **NU EXISTĂ** |
| Afișare vizibilă a etichetei pe profilul public | Prin badge-uri (dacă e acordat) — dar nu există un tip explicit "cont business" cu formulare separate |
| Sistem `business_applications` + tabel `venues/events/offers` cu `owner_id` | EXISTĂ (portalul partener `/partner`) — deja există flux ONG/BAR/CLUB dar prin `business_applications`, nu prin etichetă pe cont user normal |

**Concluzie**: eticheta există sub 2 forme: (1) `user_roles.role='partner'` + `business_applications` (flux formal cu portal separat), (2) badge manual (`ngo_partner`, `bar_verified`) doar decorativ. Nu există toggle rapid "acest cont este ONG" din User 360.

### RAPOARTE
| Item | Stare |
|---|---|
| Tabel `reports` (reporter_id, reported_id, reason, status, resolved_by, assigned_moderator_id) | EXISTĂ+FUNCȚIONEAZĂ |
| `ReportsPanel` în `/admin` (section=reports) | EXISTĂ+FUNCȚIONEAZĂ | Listează pending, permite suspend/ban/resolve/dismiss inline (folosește RPC-urile `moderator_*`). |
| Tab "reports" în User 360 | EXISTĂ | Doar afișare tabelară (rapoarte primite + făcute de user). |
| **Legătură raport → deschide profil user cu context raport** | SCHELET | Există doar `reported_id` slice(8) în MiniTable, fără link către `/admin/users/$id`. |
| **Notificare reporter când e rezolvat** | NU EXISTĂ |
| `assigned_moderator_id` folosit | SCHELET | Coloană există, dar `ReportsPanel` nu asignează. |
| Server fn dedicat `adminResolveReport` cu audit | NU EXISTĂ (se face update direct pe tabel) |

### CONTURI MULTIPLE (duplicate detection)
| Semnal | Stare |
|---|---|
| `device_fingerprints` (fingerprint + user_id) | EXISTĂ+FUNCȚIONEAZĂ |
| `banned_fingerprints` | EXISTĂ+FUNCȚIONEAZĂ |
| `getFraudClusters` (intelligence.functions) | EXISTĂ+FUNCȚIONEAZĂ | Grupează device_fingerprints ≥2 useri, returnează clustere. UI: `FraudClusterPanel`. |
| IP per user stocat direct | NU EXISTĂ (doar hash SHA-256 tranzitoriu în anumite loguri) |
| Email similar / +alias / .-dot | NU EXISTĂ |
| Detectare pe device+IP combinat | LIPSĂ (nu avem IP) |
| Acțiuni bulk pe cluster (ban în masă cu audit per user) | NU EXISTĂ |

Fezabil FĂRĂ să atingem privacy: device_fingerprint (deja e), email normalization (dot/plus alias). IP-ul ar cere hash stabil per user în auth log — nu există.

## C. Break-glass (sensibil)

| Item | Stare |
|---|---|
| `adminBreakGlassReveal` kinds valide | `orientation` (super_admin), `location` (super_admin, decripta prin `admin_reveal_profile_location`), `messages` (admin+). `health` și `selfie` **ELIMINATE** (Ventuza nu procesează HIV; selfie prin panel intern verification cu signed URL 30s). |
| `admin_can_access_sensitive` (RPC gate) | EXISTĂ+FUNCȚIONEAZĂ |
| `admin_sensitive_access_log` (append-only) | EXISTĂ+FUNCȚIONEAZĂ |
| `admin_audit_log` (severity=critical la orice reveal) | EXISTĂ+FUNCȚIONEAZĂ |
| `profiles.location` (PostGIS) | Coordonate exacte în DB, RLS: doar owner. Break-glass expune prin RPC dedicat. |
| MFA obligatoriu pentru admin/super_admin | EXISTĂ+FUNCȚIONEAZĂ (`assertAdminMfa`) |

## D. GAP-URI FAȚĂ DE CE VREA FONDATORUL

| Cerință fondator | Stare curentă | Ce lipsește |
|---|---|---|
| **Ban minor/reguli funcțional** | 3 sisteme paralele, permanent NEenforced | Unificare într-un singur RPC + patch `assert_account_usable` să verifice `banned_at` și `suspended_until` |
| **Badge-uri verificare (manual)** | EXISTĂ complet (catalog + UI + audit) | ✅ nimic |
| **Etichete ONG/BAR/CLUB/PARTENER** | Parțial (badge manuale + roluri) | Coloană `profiles.account_type` + editor rapid în User 360 + afișare pe cardul public |
| **Rapoarte (vede + intervine)** | ReportsPanel funcțional, dar deconectat de User 360 | Link raport → profil, `adminResolveReport` cu audit + notificare opțională reporter, asignare moderator |
| **Detectare conturi multiple** | `getFraudClusters` (device fingerprint) | Email normalization + acțiune bulk cluster + evidențiere clustere pe profilul individual |
| **Totul în profilul user (când îl deschide)** | 9 taburi separate, badge doar în `enterprise` | Consolidare: card "Sancțiuni active" (ban/suspend/shadowban), card "Etichete/Roluri", card "Alte conturi legate" (cluster fingerprint), card "Rapoarte în așteptare" — toate pe tab overview cu acțiuni inline |

## Fișiere-cheie relevante pentru fondator

- Ban/moderare: `src/lib/admin-enterprise.functions.ts` (adminBanUser/Suspend/Unban), RPC `moderator_ban_user` / `moderator_suspend_user`, gate `public.assert_account_usable()`.
- Badge: `src/lib/admin-badges.functions.ts`, `badge_registry`, `user_badge_grants`, UI în `EnterpriseUser360Panel.tsx`.
- Rapoarte: `src/routes/admin.tsx` → `ReportsPanel` (linia 1243), tabelul `reports`.
- Fraud clusters: `src/lib/admin-intelligence.functions.ts` → `getFraudClusters`, `device_fingerprints`.
- Break-glass: `src/lib/admin-break-glass.functions.ts`, `admin_sensitive_access_log`.

Zero modificări făcute. Aștept decizia ce vrei să prioritizăm.
