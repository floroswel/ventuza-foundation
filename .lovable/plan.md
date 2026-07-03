# Redesign verificare — plan execuție

Decizii user:
- Păstrez decizia (pass/fail) din Didit, șterg PII (session_id, raw_payload, selfie_url extern).
  Userii verificați rămân verificați cu `verification_method='didit_legacy'`.
- Age gate rămâne HARD ON în producție. User pending are ACCES LIMITAT: profil,
  safety, legal. Blocat: swipe, chat, discover, evenimente, ofertă.

## Faze

### F1 — Fundație DB (migrația 1) — ACEST TURN
- Rol nou `verification_moderator` în `app_role` enum
- Tabele:
  - `verification_requests` (user_id, status, method, version, submitted_at, decided_at, decision, reason, score, moderator_id, second_moderator_id, needs_second, appeal_of, ip_hash, ua_hash, country, review_duration_ms, retention_until, is_seed)
  - `verification_images` (request_id, storage_path, order_idx, challenge_code, captured_at, deleted_at)
  - `verification_challenges` (canonical list of allowed liveness codes + label)
  - `verification_audit` (append-only, RLS: super_admin + auditor)
- Storage bucket privat `verification` (5MB/img, image/*)
- RLS strict: user vede doar propriile requests (fără images), moderator vede
  DOAR request claimed (cu semnătură scurtă), super_admin toate metadatele.
- RPC-uri:
  - `verification_generate_challenges()` → 3 random unice
  - `verification_submit_request(challenges jsonb, image_paths text[])`
  - `verification_moderator_claim()` → next pending, atomic
  - `verification_moderator_decide(req_id, decision, reason, confidence)`
  - `verification_appeal(req_id, note)`
  - `verification_purge_expired()` (cron, șterge fișiere + soft nullify metadata)
  - `verification_signed_url(image_id)` → 30s expiry, gated
- Migrez `profiles.age_status` → `profiles.verification_status`
  (approved→approved, pending→pending, unverified→unverified, rejected→rejected)
  păstrez alias view până termin refactor client
- Scot din `age_verifications`: `didit_session_id`, `raw_payload`, `selfie_url`.
  Păstrez decizia ca `verification_method='didit_legacy'` mutată în noua tabelă
- Update `assert_age_verified()` să citească din `profiles.verification_status`
- Nou `assert_verification_or_limited()` pentru RPC-uri limitate (permite pending)
- `SENSITIVE_COLUMNS` update (verification_images.storage_path, ip_hash etc.)
- Adaug consimțământ nou `internal_verification` în `consent_kinds()` +
  `CONSENT_REGISTRY`
- Retention: cron zilnic `verification_purge_expired`

### F2 — Șterg cod Didit
- `src/lib/age-verification.functions.ts` → înlocuit cu `src/lib/verification.functions.ts` nou
- `src/routes/api/public/age-webhook.ts` → șters
- Secrets: mesaj către user să șteargă DIDIT_API_KEY, DIDIT_WORKFLOW_ID, DIDIT_WEBHOOK_SECRET
- `src/lib/admin-age-reset.functions.ts` → rescris ca `admin-verification-reset`
- Referințe din: `discover.tsx`, `account.tsx`, `sale-pitch.tsx`, `safety.tsx`,
  `admin.tsx`, `admin.users.$id.tsx`, `admin-break-glass.functions.ts`,
  `admin-overview.functions.ts`, `admin-wave1.functions.ts`, `admin.functions.ts`,
  `discover.ts`, `badges-registry.ts`, `consent-registry.ts`,
  `ConsentsCard.tsx`, `EnterpriseSections.tsx`, `nearby-points.test.ts`

### F3 — User UI verificare
- `src/components/AgeGate.tsx` rescris:
  - Ecran 1: acceptare declarație 18+ + consimțământ `internal_verification`
  - Ecran 2: primesc 3 challenges random, buton "Începe captura"
  - Ecran 3: getUserMedia camera front, capture 3 selfie-uri (1 per challenge)
    cu instrucțiune vizibilă, countdown 3s, preview + retake
  - Ecran 4: submit → thank you + status pending (limitat până approve)
- Guard rute: `SessionGuards` sau nou `LimitedAccessGuard` blochează pentru
  pending: `/discover`, `/messages`, `/events`, `/nearby`, `/offers`, `/groups`.
  Permis: `/`, `/n`, `/profile`, `/settings`, `/safety`, `/legal/*`, `/account`

### F4 — Admin moderator UI
- `src/routes/admin.verification.tsx` nou:
  - Statistici: pending/approved/rejected/appeals/avg review time
  - Buton "Claim next" → deschide 1 request cu 3 imagini (signed URL 30s)
  - Watermark peste imagini cu moderator_id + timestamp (contra screenshot)
  - CSS: no-download, no-context-menu, pointer-events blocare drag,
    user-select: none, disable right-click, disable image save shortcuts
  - Decision: approve/reject/needs_second/appeal_required + reason mandatory
  - Second reviewer NU vede decizia first-ului
- Dashboard cu grafice: queue size, moderator throughput

### F5 — Notificări
- `notifications` insert la: submitted, approved, rejected, appeal, needs_photos

### F6 — Privacy / Terms / Subprocesatori / Registru Art.30
- `legal.privacy.tsx`: rescriu secțiunea verificare (fără biometric extern,
  proces intern, retenție 30 zile)
- `legal.age-policy.tsx`: rescriu procedură
- `legal.subprocessors.tsx`: SCOT Didit
- `docs/gdpr-art-30-register.md`: scot Didit, adaug proces intern
- `legal.data-safety.tsx`: update
- `legal.records-of-processing.tsx`: update
- Terms: adaug declarație "confirm 18+ real, sub sancțiunea ban permanent"

### F7 — Security audit final
- OWASP Top 10 pe fluxul nou
- Verific RLS pe toate tabelele noi
- Verific RBAC pe RPC-uri
- Verific signed URL expiry
- Raport final

## Reguli permanente actualizate în cod
- REGULA — Age Gate: elimin referință Didit, înlocuiesc cu proces intern
- REGULA — Consimțăminte: adaug `internal_verification`
- Elimin REGULA — Cifrare date sănătate rămâne (nu se schimbă)
