# Portal Partener — `/partner/*`

Construit deasupra modulului de moderare existent (`admin_moderate_item`, triggere `*_no_self_publish`, `admin_suspend_partner`, RLS owner-only, `partner_quotas` din `app_settings`). Respectă REGULA MODERARE OBLIGATORIE din AGENTS.md.

## A) Acces

- Rută layout pathless: `src/routes/_partner.tsx` (`ssr: false`) — guard client: `supabase.auth.getUser()` + `has_role(uid, 'partner')` + verifică `profiles.partner_suspended_at`. Dacă suspendat → afișează banner read-only în tot subtree-ul.
- Toate server fns adaugă `assertPartner(supabase, userId)` (verifică rol + not suspended) ÎNAINTE de orice mutație.

## B) Rute

- `/_partner/dashboard` — listă combinată venues+events+offers proprii, status moderare cu badge color-coded, motiv respingere afișat inline; widget quota (venues used/max, offers active/max) din nou RPC `partner_get_quota_usage()`.
- `/_partner/venues` listă + `/_partner/venues/new` + `/_partner/venues/$id/edit`.
- `/_partner/events` + `/_partner/events/new` + `/_partner/events/$id/edit` (select din venues proprii pentru legare).
- `/_partner/offers` + `/_partner/offers/new` + `/_partner/offers/$id/edit` (select venue propriu + buton "Vezi stats" → modal cu `offer_stats` agregat).

## C) Server fns — `src/lib/partner.functions.ts`

Toate cu `requireSupabaseAuth` + `assertPartner`:
- `partnerListMyItems()` — venues/events/offers ale owner-ului prin `supabase` (RLS aplică automat).
- `partnerGetQuotaUsage()` — citește `app_settings.partner_quotas` + count items.
- `partnerCreateVenue/Event/Offer({...})` — validează Zod, **enforcement quota server-side** (throw `quota_exceeded` dacă > limită), rate-limit (max 5 drafts / oră / partner prin `rate_limit_log`), insert cu `moderation_status='pending'`. Câmpurile `is_published`, `is_official`, `moderated_*` NU sunt acceptate de validator — sunt stripped.
- `partnerUpdateVenue/Event/Offer({id, patch})` — verifică ownership, validează patch (exclude `is_published`/`is_official`/`moderation_status`), iar dacă itemul era `approved` resetează la `pending` + setează `is_published=false` (re-moderare obligatorie). Loghează în `admin_audit_log`.
- `partnerGetOfferStats({offerId})` — proxy la RPC `offer_stats` (doar count agregat).

## D) DB — migrare minimă

```sql
-- helper quota
CREATE OR REPLACE FUNCTION public.partner_get_quota_usage(p_user uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'venues', (SELECT count(*) FROM venues WHERE owner_id=p_user),
    'events', (SELECT count(*) FROM events WHERE host_id=p_user),
    'offers', (SELECT count(*) FROM offers o JOIN venues v ON v.id=o.venue_id WHERE v.owner_id=p_user),
    'quotas', (SELECT value FROM app_settings WHERE key='partner_quotas')
  )
$$;
GRANT EXECUTE ON FUNCTION public.partner_get_quota_usage(uuid) TO authenticated;

-- seed default quotas dacă lipsesc
INSERT INTO app_settings(key,value,description)
VALUES ('partner_quotas',
  '{"max_venues":10,"max_events":50,"max_active_offers":20,"max_drafts_per_hour":5}'::jsonb,
  'Limite per partener (creare resurse)')
ON CONFLICT (key) DO NOTHING;
```

(Triggerele `*_no_self_publish` și suspendarea cascade există deja — nu le modificăm.)

## E) UI

- `src/components/partner/PartnerLayout.tsx` — sidebar (Dashboard/Venues/Events/Offers), badge quota, banner suspendat.
- `src/components/partner/VenueForm.tsx` — folosește `NearbyMap` existent (MapLibre) pentru a pune pin-ul; câmpuri: name, category, description, address, city, lat/lng (pin), cover_url (upload bucket existent `venues` sau `public-uploads`), opening_hours (JSON simplu), website, phone.
- `src/components/partner/EventForm.tsx` — title, description, event_type, venue_id (select propriu), starts_at, ends_at, max_attendees, cover_url. **Fără `is_official`**.
- `src/components/partner/OfferForm.tsx` — venue_id, title, description, terms, valid_from/to, max_claims_per_user. Buton "Stats" → `partnerGetOfferStats` (claim_count/redeemed_count, fără identități).
- `src/components/partner/ModerationStatusBadge.tsx` — pill cu culoare + motiv respingere.
- Upload imagini: validare client (tip image/*, max 5MB), upload Supabase Storage într-un bucket public; ulterior moderarea staff vede imaginea.

## F) Confirmări la final

(a) Formularele NU expun `is_published`/`is_official`; validator-ul Zod le strip-uiește; triggerele DB blochează oricum.
(b) `partnerUpdate*` pe item `approved` → forțează `moderation_status='pending'` + `is_published=false`. Loghează în audit `re_moderation_required`.
(c) `partnerCreate*` verifică `partner_get_quota_usage` server-side + rate-limit pe `rate_limit_log` — throw înainte de insert.
(d) Toate listările folosesc clientul `requireSupabaseAuth` (NU `supabaseAdmin`), deci RLS owner-only se aplică. `partnerGetOfferStats` întoarce doar `{claim_count, redeemed_count}`.

## Ordine

1. Migrare DB (quota helper + seed `app_settings`).
2. `src/lib/partner.functions.ts`.
3. Rute `_partner/*` + componente form.
4. Link din `/business.dashboard` către `/partner/dashboard` pentru utilizatori cu rol partener.
5. Typecheck + smoke test în preview.

**Aștept confirmarea ta înainte să implementez.**
