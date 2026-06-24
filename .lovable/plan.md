# Ventuza Enterprise Admin - Roadmap

Construim peste `/admin` existent. Execut toate sprint-urile în ordine, fără să întreb între ele (conform preferinței tale).

## Sprint 1 - Auth & RBAC hardening
- Extind enum `app_role` cu `support` și `auditor` (avem deja `admin`, `moderator`, `user`, `business`; adăugăm `super_admin`).
- Funcții SQL: `has_any_role()`, `get_user_roles()`, `is_admin_or_above()`.
- MFA TOTP obligatoriu pentru orice rol admin: gate la intrare `/admin` care forțează `aal2` via `supabase.auth.mfa`.
- Auto-logout 15 min idle pe `/admin` + re-auth (password prompt) pentru acțiuni critice (ban, delete, role grant).
- RLS strict pe toate tabelele admin: vizibilitate pe rol (Support nu vede subscriptions financiare, Auditor doar `SELECT`, etc.).
- IP allowlist opțional în tabel `admin_ip_allowlist` (gol = dezactivat).

## Sprint 2 - Immutable Audit Log
- Tabel `admin_audit_log` (append-only): `actor_id, action, target_table, target_id, before, after, ip, user_agent, justification, created_at`.
- Trigger care blochează UPDATE/DELETE pe acest tabel (even super_admin).
- Helper `logAdminAction()` apelat din toate server functions.
- UI: viewer cu filtre (actor, action, dată, target) + export CSV.

## Sprint 3 - CSAM & Safety Pipeline
- Tabel `photo_hashes` extins cu `csam_match`, `nudity_score`, `scan_status`.
- Server function `scanUpload()` care: (1) calculează pHash, (2) verifică `csam_hash_blocklist`, (3) rulează nudity classifier (Lovable AI vision), (4) blochează+quarantine la match.
- Tabel `csam_reports` pentru raportare NCMEC (cu placeholder API key).
- Integrat în `PhotoManager` și `stories.ts` (deja avem moderation - extindem).
- Alert real-time în dashboard la match CSAM.

## Sprint 4 - GDPR Tools
- Export date utilizator (Art. 20) - server fn `exportUserData()` → ZIP JSON cu toate datele.
- Right to be forgotten - soft delete + cron hard-delete după 30 zile.
- Tabel `consent_log` + `policy_versions` (terms/privacy versioning).
- Tabel `breach_incidents` cu countdown 72h.
- Modul DSA: tabel `illegal_content_reports` cu queue admin.
- Cifrare câmpuri sensibile (orientare): RLS + coloană marcată `sensitive`.

## Sprint 5 - Moderation Suite
- Queue unificat: reports + flagged photos + flagged messages.
- Acțiuni: warn, shadowban (`profiles.shadowbanned`), suspend, ban - fiecare cere `justification` text.
- Bot/scam signals: vârsta cont + mesaje/oră + duplicate text.
- Anti-harassment: filtru cuvinte pe `messages` insert trigger.

## Sprint 6 - User Management Pro
- Search avansat (status, oraș, vârstă cont, raportări).
- Drawer detaliu user: istoric moderare, consimțăminte, sesiuni, devices.
- Bulk actions cu confirmare + logged reason.

## Sprint 7 - Dashboard & Alerts
- Overview live: counters + sparkline 24h.
- Real-time alerts (Supabase realtime pe `admin_alerts`): CSAM, breach, mass-delete, login anomaly.
- Anomaly detection: query pe `admin_audit_log` pentru spike-uri.

## Sprint 8 - Security headers & Polish
- CSP/HSTS în `src/server.ts`.
- Rate limit pe login admin (table `admin_login_attempts`).
- A11y pass pe UI admin.

## Detalii tehnice
- Toate operațiile prin `createServerFn` cu `requireSupabaseAuth` + `assertRole()`.
- `supabaseAdmin` doar pentru audit insert și Auth Admin API.
- UI: extind `src/routes/admin.tsx` cu tab-uri noi; componente sub `src/components/admin/`.
- Migrații Supabase pentru fiecare sprint (GRANT + RLS în aceeași migrare).

Încep imediat cu **Sprint 1** după ce confirmi planul. Sau spune-mi de unde să sar dacă vrei altă ordine.
