# Modul Admin — Venues / Events / Oferte & Parteneri

Construit deasupra fundației existente: RBAC (`has_role`, `is_staff`, `is_admin_or_above`), `admin_audit_log`, break-glass, sistemul nearby (`venues`, `events`, `offers`, `offer_claims`, `nearby_points`), rolul `business`/`partner` și `business_applications`.

## A) Rol & onboarding partener

**DB (migrare):**
- Reutilizez rolul `business` ca rol partener (există deja în enum). Nu adaug rol nou.
- `business_applications` deja există (27 coloane, status pending/approved/rejected). Extind cu: `venue_type text`, `proof_url text`, `reviewer_notes text`, `suspended_at timestamptz`.
- Trigger `on_business_application_approved`: la `status='approved'` → upsert `user_roles(business)` + creează venue draft legat (`venues.owner_id = applicant`).
- Funcție `admin_suspend_partner(user_id, reason)` → setează `suspended_at`, revocă `business` role, marchează `venues.status='hidden'` și `offers.status='hidden'` pentru toate resursele owner-ului (ASCUNDERE INSTANT).

**Server fns (`src/lib/admin-partners.functions.ts`):**
- `adminListBusinessApplications({ status })` — listă cu filtrare.
- `adminReviewBusinessApplication({ id, decision: 'approved'|'rejected'|'changes_requested', notes })` — audit, notifică owner.
- `adminListPartners({ q })` — owneri cu rol `business` + count venues/offers + status.
- `adminSuspendPartner({ userId, reason })` / `adminReinstatePartner({ userId })`.

## B) Coadă unificată de moderare

**DB:**
- Asigur coloana `status` pe `venues`, `events`, `offers` cu valori: `draft|pending|approved|rejected|changes_requested|hidden|expired`. Default la insert by owner = `pending`. RLS existent deja interzice owner-ului să seteze `approved`.
- View `admin_moderation_queue` care UNION-uiește cele trei cu coloanele comune (`kind, id, owner_id, name, status, created_at, updated_at, cover_url, city`).

**Server fns (`src/lib/admin-moderation.functions.ts`):**
- `adminListModerationQueue({ kind?, status?, limit, offset })`.
- `adminGetModerationItem({ kind, id })` — full payload (text, imagini, lat/lng pentru hartă admin — admin **are** voie să vadă coords venue, NU coords user; venues sunt date publice).
- `adminModerateItem({ kind, id, decision, reason?, notification_radius_m? })`. Audit `critical`-ish; la `approved` setează `approved_at, approved_by`.
- `adminFlagItem({ kind, id, reason })` — re-trimite în coadă după raport user.

## C) Control per punct

**DB:**
- Coloane pe `venues`/`events`/`offers`: `notification_radius_m int default 2000`, `is_official boolean default false` (event al aplicației → priority_access), `max_notifications_per_day int default 1`.
- `events.ends_at` deja există — cron/expirare prin trigger `expire_old_events()` (job pg_cron sau check on-read în `nearby_points`).
- `partner_limits` în `app_settings`: `partner_max_venues`, `partner_max_active_offers`, `partner_max_notifications_per_day`.

**Server fns:**
- `adminUpdatePoint({ kind, id, patch })` — patch validat (radius, is_official, schedule, status).
- `adminEnforcePartnerLimits(ownerId)` — verifică limita înainte de aprobare.

## D) Oferte — moderare specifică

- În `adminGetModerationItem` pentru `kind='offer'` includ: titlu, descriere, condiții, valabilitate, cod redemption (masked), `offer_stats` (claims/redeemed — fără identități; folosesc RPC existent `offer_stats`).
- Checklist UI: "valabilitate clară", "condiții legitime", "nu e înșelătorie".

## E) Anti-abuz & siguranță

- Suspendare partener → trigger SQL ascunde tot conținutul (status='hidden'). `nearby_points` filtrează DOAR `status='approved'`.
- Tabel `nearby_user_reports` (raport user pe venue/offer): `reporter_id, kind, target_id, reason, created_at`. Insert din user UI; admin vede în coadă. RLS: insert authenticated, select staff.
- Notificări: tabel `partner_notification_log` + RPC `partner_can_send_notification(owner_id)` → verifică limita zilnică din `app_settings`. Trigger pe `notifications` (când partener emite push pentru venue) blochează peste limită.
- Toate acțiunile (review, suspend, moderate, flag, update limits) → `admin_audit_log`.

## UI (`src/components/admin/PartnersSections.tsx` + integrare în `src/routes/admin.tsx`)

Tab nou **"Parteneri & Locuri"** cu sub-secțiuni:
1. **Aplicații parteneri** — tabel cu Aprobă/Respinge/Cere modificări + modal review.
2. **Coadă moderare** — tabs Venues/Events/Offers/Toate, card cu imagine, hartă embed (MapLibre reused), text, owner, butoane Aprobă/Respinge (motiv obligatoriu)/Cere modificări + control radius notificare + toggle `is_official`.
3. **Parteneri activi** — listă cu Suspendă/Reactivează, count resurse, link la audit.
4. **Rapoarte useri** — coadă rapoarte pe venues/offers cu acțiune rapidă.
5. **Limite anti-spam** — formular legat de `app_settings` (citește/scrie prin `admin_update_setting`).

## AGENTS.md — regulă nouă

```
## REGULĂ — MODERARE VENUES/EVENTS/OFERTE (permanentă)
1. Owner NU poate seta status='approved' pe venues/events/offers (RLS + verificare server).
2. Doar staff (moderator/admin/super_admin) prin adminModerateItem.
3. nearby_points returnează DOAR status='approved' AND owner suspended_at IS NULL.
4. Suspend partener → cascade status='hidden' pe toate resursele (trigger DB), instant.
5. Notificări push partener → gate prin partner_can_send_notification(owner_id) cu limită din app_settings.
6. Toate acțiunile (approve/reject/suspend/reinstate/limits update) → admin_audit_log.
7. Code review automat REFUZĂ orice diff care: ocolește gate-ul de status pe nearby_points, dă GRANT EXECUTE pe admin_* fns către anon/authenticated, sau permite owner-ului să modifice status la 'approved'.
```

## Confirmări finale (după implementare)

(a) Owner nu publică singur — RLS + status enum + admin-only RPC.
(b) Suspendare → cascade `status='hidden'` în aceeași tranzacție, `nearby_points` filtrează imediat.
(c) Limite anti-spam → `partner_can_send_notification` + `app_settings`.
(d) Moderare pre-publicare → coada blochează tot `pending` din `nearby_points`.

## Ordine de execuție

1. Migrare DB (extinderi coloane, view, triggere suspend/expire, RPCs, app_settings keys).
2. Server fns (partners + moderation).
3. UI Admin (PartnersSections + integrare admin.tsx).
4. UI user: buton "Raportează" pe `venues.$id.tsx` / `offers.$id.tsx`.
5. AGENTS.md regulă nouă.
6. Typecheck + verificare în preview.

**Nu trec mai departe până nu confirmi.**