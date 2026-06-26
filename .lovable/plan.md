
# Nearby — Descoperă lângă tine

Notă: în DB există doar `public.events` (cu `lat`/`lng`/`venue` text). NU există încă tabele `venues` și `offers`. Acest plan le creează ca parte din livrare. Spune-mi dacă vrei să le sar (atunci feature-ul se va limita la `events`).

## Confirmări de conformitate (înainte de cod)

a) **Locația precisă a userului NU pleacă la server.** Serverul primește doar un `geo_bucket_id` calculat client-side (grilă ~5 km, derivată din coordonate rotunjite — exact aceeași filozofie ca `bucket_distance_m`). RPC-ul `nearby_points` întoarce toate punctele publice din bucket-ul cerut + bucket-urile vecine (3×3). Distanța exactă față de venue se calculează pe device.

b) **Harta NU introduce procesator nou.** Folosim **MapLibre GL JS** cu tile-uri **OpenStreetMap** (`tile.openstreetmap.org`) — fără cheie API, fără tracking SDK. OSM este deja un procesator "neutru" pentru date tehnice (IP la fetch de tile), dar pentru claritate îl adaug în `legal.subprocessors.tsx` ca P10 — categorie: tile-uri hartă, doar IP + tile bbox, fără PII, fără date Art. 9. Niciun Google Maps, niciun Mapbox.

c) **Ofertele respectă minimizarea.** `offer_claims` reține: `offer_id`, `claimed_at`, `redemption_code` (random per claim). NU expune `user_id` partenerului în UI — partenerul vede DOAR `count(*)` și (opțional) `redemption_code` pentru validare la fața locului. Tabela are RLS: userul își vede claim-urile lui, partenerul vede agregate prin RPC `offer_stats(offer_id)`.

## Model de date (migrare)

```sql
-- venues: locuri publice (baruri, cluburi, cafenele queer-friendly)
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users,        -- partener care îl administrează (opțional)
  name text not null,
  slug text unique,
  category text not null,                     -- 'bar','club','cafe','sauna','shop','other'
  description text,
  cover_url text,
  address text,
  city text,
  lat double precision not null,
  lng double precision not null,
  geo_bucket_id text not null,                -- generat de trigger din lat/lng (grilă 5km)
  opening_hours jsonb,                        -- {mon:[["18:00","02:00"]],...}
  website text, phone_e164 text,
  is_published boolean default false,         -- moderare obligatorie
  moderated_by uuid, moderated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- offers: promoții ale unui venue
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues on delete cascade,
  title text not null,
  description text,
  terms text,
  valid_from timestamptz, valid_to timestamptz,
  max_claims_per_user int default 1,
  is_published boolean default false,
  moderated_by uuid, moderated_at timestamptz,
  created_at timestamptz default now()
);

-- claim-uri (minimizare: doar ce e necesar)
create table public.offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  redemption_code text not null,              -- random per claim, validabil la venue
  claimed_at timestamptz default now(),
  redeemed_at timestamptz,
  unique (offer_id, user_id, claimed_at)
);

-- events: adăugăm geo_bucket_id pe tabela existentă
alter table public.events add column geo_bucket_id text;
```

Triggere: `set_geo_bucket_id` pe `venues` și `events` (BEFORE INSERT/UPDATE OF lat,lng) — calculează bucket-ul din `(floor(lat*20)::text || ':' || floor(lng*20)::text)` (≈5 km lat).

RLS:
- `venues`: SELECT TO anon, authenticated WHERE `is_published=true`; owner poate update; super_admin moderează.
- `offers`: SELECT public unde `is_published` și `venue.is_published`; owner CRUD pe ofertele venue-ului lui.
- `offer_claims`: user vede DOAR rândurile lui (`user_id = auth.uid()`); owner-ul venue-ului NU vede direct (vede prin RPC agregat).

GRANT-uri standard (anon SELECT pe venues/offers publice; authenticated CRUD pe claims; service_role ALL).

## RPC-uri server-side

- `nearby_points(p_bucket_id text, p_kinds text[])` — SECURITY DEFINER, anon+authenticated. Returnează în 3×3 buckets în jur: `(kind, id, name, lat, lng, category, cover_url, starts_at, distance_bucket_label_to_center)`. NU primește lat/lng userului. NU loghează nimic identificabil.
- `claim_offer(p_offer_id uuid)` — authenticated. Verifică `max_claims_per_user`, generează `redemption_code`, întoarce codul.
- `offer_stats(p_offer_id uuid)` — owner-only. Întoarce `{claim_count, redeemed_count}`.

Rate limit ad-hoc pe `nearby_points` (per user/IP, in-memory în handler — backend-ul nu are primitivă standard, e ok ca soft-limit).

## Cod client

### Helper locație (device-only)
`src/lib/geo-bucket.ts`
- `getCurrentBucket()` — citește `navigator.geolocation` (sau cache 60s), rotunjește la grila 5km, întoarce `bucket_id` + `lat`/`lng` păstrate DOAR în memorie locală.
- `distanceMeters(a, b)` — Haversine pe device.
- `formatDistance(m)` — "450m" / "1.2km".

### Server fn
`src/lib/nearby.functions.ts`
- `getNearbyPoints({ bucketId, kinds })` — publishable client → RPC `nearby_points`. Niciun user lat/lng în payload.
- `claimOffer({ offerId })` — `requireSupabaseAuth` → RPC `claim_offer`.

### UI
`src/routes/nearby.tsx` — ruta principală.
- Tab principal nou în nav (între Discover și Events).
- Header: toggle **Listă / Hartă**, tab-uri **Evenimente / Localuri / Oferte**, selector rază (2/5/10 km, default 2).
- Listă: `NearbyCard` cu poster, nume, categorie, distanță exactă (calculată client), CTA (Detalii / RSVP / Revendică).
- Hartă: `NearbyMap` cu MapLibre + OSM tiles. Marker user-pin (poziție DOAR locală, nu trimisă). Pini venues/events. Tap pin → bottom-sheet card.
- Stare goală: "Nimic în {raza}km. Extinde la 5/10 km" + buton "Anunță-mă când apare ceva" (creează preferință push — necesită consimțământ `push_notifications` deja existent).
- Refresh: `watchPosition` cu prag 250m (mișcare semnificativă), throttle 30s pe `getNearbyPoints`.

`src/routes/venues.$id.tsx` și `src/routes/offers.$id.tsx` — pagini detaliu (program, hartă mică, buton "Direcții" → `geo:` URI / Google/Apple Maps deep-link, RSVP/Claim).

Founders: badge "Acces prioritar" pe `EventCard` când userul are `is_founder=true`; RSVP-ul lor primește flag `priority=true` în `event_rsvps` (coloană nouă mică).

### Subprocesatori
Actualizez `src/routes/legal.subprocessors.tsx` cu **P10 — OpenStreetMap Foundation** (UK, GDPR adequacy, doar IP+bbox la fetch tile-uri, fără PII, fără Art. 9). Actualizez `docs/gdpr-art-30-register.md` cu activitatea "Descoperire locuri/evenimente lângă tine" (temei Art. 6(1)(b) — executare contract, fără Art. 9, fără locație precisă transmisă).

## Tehnic — pachete

- `maplibre-gl` (~200KB, MIT, fără tracking).
- Fără `@capacitor/geolocation` nou — folosim `navigator.geolocation` care funcționează deja în WebView Capacitor cu permisiuni native existente.

## Out of scope (le confirm separat)

- Geofencing nativ (notificări push la apropiere de venue) — necesită background tracking + permisiune extra. Doar UI-ul "Anunță-mă" e inclus; logica server o livrez în sprint următor.
- Panou admin venues/events (CRUD partener, moderare) — există deja structura admin; integrarea efectivă a venues/offers în modulul admin e sprint separat.
- Sistem de plată pentru oferte premium / vouchere plătite.

## Livrabile (în ordine)

1. Migrare DB (venues, offers, offer_claims, geo_bucket triggers, RPC-uri, RLS, GRANT-uri).
2. `geo-bucket.ts`, `nearby.functions.ts`.
3. `src/routes/nearby.tsx` + componente (`NearbyList`, `NearbyMap`, `NearbyCard`, `EmptyState`).
4. `src/routes/venues.$id.tsx`, `src/routes/offers.$id.tsx`.
5. Update `legal.subprocessors.tsx` + `docs/gdpr-art-30-register.md`.
6. Link în nav principal.

Confirmă și încep cu migrarea.
