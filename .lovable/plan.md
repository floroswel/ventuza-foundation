# Analiză verificare vârstă — Ventuza (iulie 2026)

**ZERO modificări.** Raport pe cod real + DB reală.

---

## TL;DR

**Sursa unică de adevăr pentru „18+" este Didit.** Fluxul intern (liveness + moderator uman) există ca schelet în DB și cod, dar este **oficial dezactivat** — UI-ul nu îl mai apelează, panoul admin este marcat DEPRECATED, tabelele sunt goale (1 rând istoric în `verification_requests`, 5/5 profiluri verificate au `verification_method='didit'`).

---

## 1. Integrare Didit — ACTIVĂ

**Fișiere:**
- `src/lib/didit.server.ts` — API client (create session, fetch decision, HMAC verify, mapping status).
- `src/lib/didit.functions.ts` — 3 server fn-uri: `startDiditVerification`, `getMyDiditStatus`, `syncMyDiditStatus`.
- `src/routes/verify.tsx` — UI complet care apelează `startDiditVerification` → redirect la Didit, poll status la 5s când `age_status='pending'`.
- `src/routes/verify.status.tsx` — landing după return din Didit.
- `src/routes/api/public/didit-webhook.ts` — webhook handler (vezi §3).

**Endpoint Didit folosit:** `https://verification.didit.me/v3/session/` (POST create), `/session/{id}/decision/` (GET refresh).

## 2. Variabile de mediu Didit — 3 setate

- `DIDIT_API_KEY` — server-only, folosit în `diditCreateSession` + `diditFetchDecision`.
- `DIDIT_WORKFLOW_ID` — server-only, pasat ca `workflow_id` în create session.
- `DIDIT_WEBHOOK_SECRET` — server-only, folosit de `verifyDiditSignature` (HMAC-SHA256).

Nu există `VITE_DIDIT_*` — client-ul nu apelează Didit direct, doar prin server fn.

## 3. Webhook Didit — ACTIV

**Cale:** `POST /api/public/didit-webhook` (bypasses auth-ul pe deployment publicat, conform convenției `/api/public/*`).

**Ce face:**
1. Citește raw body → verifică semnătura HMAC (`X-Signature-V2` preferat, `X-Signature` fallback, `X-Signature-Simple` doar pentru envelope).
2. Dacă `trustedBody=false` (simple sig), re-cere decizia autoritativă via `diditFetchDecision(sessionId)`.
3. Mapează `status` Didit → `pass|fail|pending` prin `mapDiditStatus`.
4. Extrage `estimated_age` din `decision.age_estimation` / `liveness_checks[].age_estimation`.
5. Apelează RPC `didit_apply_result(_session_id, _status, _result, _estimated_age, _status_raw)` (SECURITY DEFINER, `service_role`) — care actualizează atât `didit_sessions` cât și `profiles`.

## 4. Flux intern (liveness + moderator) — SCHELET, DEZACTIVAT

**Cod care există dar NU rulează:**
- `src/lib/admin-verification.functions.ts` — 5 server fn-uri complete (list/stats/claim/take/signed-urls/decide) pe `verification_requests`.
- `src/lib/verification.functions.ts` — `verifySelfie` (AI compare selfie vs. main photo prin Gemini) și `moderatePhoto` (moderare AI). **Notă: `verifySelfie` NU face age gating** — setează `verification_status/verified_at/verified` (badge de identitate), fără să atingă `age_status`. Nu se cheamă din niciun UI activ.
- RPC-uri DB: `verification_submit_request`, `verification_moderator_claim/take/decide`, `verification_generate_challenges`, `verification_mark_purged`, `is_verification_staff` — toate există (12 funcții), zero call site UI.
- `src/components/admin/VerificationQueuePanel.tsx` — **marcat explicit DEPRECATED** cu comentariu:
  > „Din iulie 2026 verificarea vârstei se face exclusiv prin Didit — fluxul intern a fost dezactivat la cererea business-ului."

**Stare DB:**
- `verification_requests`: 1 rând total (rezidual istoric).
- `verification_images`: bucket privat + tabela există, dar nu se mai populează.
- Retenție automată configurată (30 zile), purge activ.

## 5. Ce se întâmplă pas cu pas la un user nou

1. User face signup → completează birthdate (≥18 forțat de trigger DB `enforce_min_age_trg`).
2. `AgeGate` (montat în root) citește `profiles.age_status`. Default: `unverified`.
3. `shouldEnforceAgeGate()` (din `age-gate-policy.ts`) → în producție forțează gate ON (ignoră feature flag).
4. `AgeGate` redirecționează la `/verify` dacă `age_status !== 'verified'`.
5. `/verify` afișează UI Didit → click „Începe verificarea" → `startDiditVerification` → creează sesiune → redirect fullscreen la URL Didit.
6. User face selfie live la Didit → Didit trimite webhook la `/api/public/didit-webhook` → `didit_apply_result` setează:
   - `didit_sessions.status/result/estimated_age/resolved_at`
   - `profiles.age_status = 'verified'|'failed'|'pending'`
   - `profiles.age_provider = 'didit'`
   - `profiles.age_verified_at = now()` (dacă pass)
   - `profiles.verified = true`, `verified_at = now()` (dacă pass)
   - `profiles.verification_status = 'verified'`
   - `profiles.verification_method = 'didit'` (**forțat** — orice altă valoare e suprascrisă la fiecare webhook Didit)
7. `AgeGate` primește update realtime pe `profiles.age_status` → deblochează app.
8. Fallback dacă webhook nu ajunge (preview / dev fără tunel): poll la 5s cheamă `syncMyDiditStatus` → `diditFetchDecision` → aplică rezultatul.

**Nicio intervenție umană.** Deciziile în review manual la Didit (`in_review`) sunt tratate ca `pending` și așteaptă tot webhook-ul Didit.

## 6. Coloane DB pentru verificare

Pe `public.profiles`:

| Coloană | Tip | Semantică |
|---|---|---|
| `age_status` | enum `age_status` (`unverified`/`pending`/`verified`/`failed`) | sursa de adevăr pentru gate |
| `age_provider` | text | `'didit'` sau NULL |
| `age_verified_at` | timestamptz | timestamp pass |
| `age_pending_at` | timestamptz | când s-a pornit sesiunea |
| `verification_status` | text | `'verified'/'rejected'/'pending'` (legacy, ținut în sync de `didit_apply_result`) |
| `verification_method` | text | **azi: `'didit'` pentru toate 5 profilurile verificate** |
| `verification_version` / `verification_score` / `verification_reviewed_by` | | scheletul intern — neutilizate |
| `verified` / `verified_at` / `verification_reason` | | badge legacy — setate și de Didit |

**Statistici azi:** 5 profiluri cu `verification_method='didit'`, 4 cu `age_status='verified'`, 14 sesiuni Didit total (4 approved).

## 7. Coadă de moderare

Există în DB (`verification_requests` cu statusuri `pending/in_review/needs_second/approved/rejected/appeal/expired`) și în cod (`admin-verification.functions.ts` complet funcțional, RPC-urile `verification_moderator_*` toate există), dar:
- Panoul admin (`VerificationQueuePanel`) e placeholder DEPRECATED — nu mai afișează coada.
- Nimic din UI nu apelează `verification_submit_request` pentru a popula coada.
- E **cod mort operațional**, viu tehnic. Dacă ai revoca decizia „Didit-only", ai putea reactiva prin remontarea unui panou care apelează server fn-urile existente.

## 8. Sursa de adevăr pentru „user e 18+"

**Didit, exclusiv.**
- Singurul cod care mută `age_status` pe `verified` este `didit_apply_result` (declanșat de webhook sau de `syncMyDiditStatus`).
- `assert_age_verified()` (gate DB pe toate RPC-urile sociale) deleagă la `assert_account_usable()` — verifică doar `age_status='verified'` + email confirmed, nu se uită la `verification_requests`.
- `age_provider` este fix `'didit'` pentru toate profilurile verificate.
- `verification_method` este forțat `'didit'` la fiecare update din webhook — schema permite alte valori (`'internal'`), dar nimic în cod nu le scrie astăzi.

**Concluzie:** Ventuza rulează pe un singur sistem: Didit. Infrastructura pentru verificare internă (tabele, RPC-uri, server fn-uri admin, bucket storage cu retenție) este intactă și reactivabilă, dar UI-ul o ignoră complet și `VerificationQueuePanel` afișează un banner explicit „dezactivat".

**Notă documentară:** `AGENTS.md → REGULĂ — AGE GATE (permanentă)` încă descrie fluxul ca „100% intern (liveness + moderator uman)". Acest text nu mai reflectă implementarea reală din iulie 2026 — la o viitoare rescriere a regulii se poate corela cu situația de facto (Didit exclusiv, intern rezidual).
