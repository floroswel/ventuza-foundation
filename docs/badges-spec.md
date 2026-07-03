# Ventuza — Badge System (spec complet)

Data: 2026-07-03
Status: aprobat — Wave 1 în execuție

## Principii

1. **Server-side authoritative**: fiecare badge se derivă dintr-un SQL view/RPC, nu din client. UI doar randează.
2. **Doar pe carduri Discover** (user + venue/event). Fără spam pe chat / profil detaliat.
3. **Max 3 badge-uri simultan** per card (verified > premium > tier > achievement). Restul se accesează din profil.
4. **Fără gamification exploatabil**: streak-urile se calculează din `xp_events` reale, nu din tap-uri auto.
5. **Extensibil**: registry unic `public.badge_registry` + TS mirror `src/lib/badges-registry.ts`.

## Catalog badge-uri (8 tipuri)

### A. User badges (pe cardul de profil în /discover)

| Cod | Nume | Icon | Culoare | Sursă (auto) | Prioritate |
|-----|------|------|---------|--------------|------------|
| `verified` | Verificat 18+ | BadgeCheck | rose-500 | `profiles.age_status='verified'` | 100 |
| `founder` | Pionier | Sparkles | amber-400 | `profiles.created_at < '2026-08-01'` (primii 5000) | 90 |
| `streak_7` | Activ 7 zile | Flame | orange-500 | 7 zile consecutive cu `xp_events` | 60 |
| `matcher` | Popular | Heart | fuchsia-500 | `matches count >= 25` | 50 |
| `explorer` | Explorator | Compass | teal-400 | ≥5 orașe diferite în `nearby_points` vizitate | 40 |

### B. Venue/Event badges (pe cardurile Nearby)

| Cod | Nume | Icon | Culoare | Sursă (auto) | Prioritate |
|-----|------|------|---------|--------------|------------|
| `partner_premium` | Premium | Crown | amber-500 | plan activ `Premium`/`Pro` în `partner_active_entitlements` | 100 |
| `partner_boost` | Boost | Rocket | rose-500 | boost activ (`ends_at > now()`) în `partner_boost_orders` | 95 |
| `official` | Official | ShieldCheck | blue-500 | `venues.is_official=true` (setat DOAR admin) | 90 |

## Reguli acordare (server-side)

- **Automat**: toate cele 8. Recalculat la fiecare mutație relevantă (trigger) sau la citire (view materializat `mv_user_badges` refresh la 15 min via pg_cron).
- **Manual (admin)**: niciunul acum. `is_official` este singurul setat manual, prin `admin_moderate_item` cu justificare + audit.
- **Retragere**: automat când condiția nu mai e adevărată (ex: expiră boost, se retrage verified). Nu există "badge etern".

## Registru autoritativ

### SQL — `public.badge_registry`
```sql
CREATE TABLE public.badge_registry (
  code text PRIMARY KEY,          -- 'verified', 'streak_7', etc.
  target text NOT NULL,           -- 'user' | 'venue' | 'event'
  label_i18n jsonb NOT NULL,      -- {ro:'Verificat', en:'Verified'}
  icon text NOT NULL,             -- lucide-react name
  color_class text NOT NULL,      -- tailwind
  priority int NOT NULL,          -- ordonare
  criteria_summary text NOT NULL, -- pentru transparență în /legal/badges
  is_active boolean DEFAULT true
);
```

### RPC — `public.get_user_badges(user_id uuid)` returns `text[]`
Calculează live din: `profiles`, `matches`, `xp_events`, `nearby_points` visited.

### RPC — `public.get_venue_badges(venue_id uuid)` returns `text[]`
Din: `venues.is_official`, `partner_active_entitlements(owner_id)`, `partner_boost_orders`.

### TS mirror — `src/lib/badges-registry.ts`
Consumat de `<BadgeStrip badges={codes} target="user" />`.

## Pagini publice

- `/legal/badges` — explică fiecare badge, criteriu, cum se pierde. Transparență = anti-abuz.
- Buton "?" pe fiecare badge din card → tooltip cu criteriu scurt.

## Wave-uri

**Wave 1 (execuție imediată):**
- Migrare: `badge_registry` + `get_user_badges` + `get_venue_badges`.
- `src/lib/badges-registry.ts` + `src/components/BadgeStrip.tsx`.
- Integrare `<BadgeStrip>` în `discover.tsx` (cardul de profil) și `NearbyCard.tsx`.
- Pagina `/legal/badges`.

**Wave 2 (după validare):**
- Materialized view `mv_user_badges` + pg_cron refresh 15 min.
- Panel admin `/admin/badges` — inspectare, freeze, override cu justificare.
- Analytics: distribuție badge-uri, corelare cu retenția.

**Wave 3 (opțional):**
- Notificări push la câștigare badge (opt-in).
- Badge-uri sezoniere (Pride Month, etc.) cu expirare automată.

## Reguli anti-abuz (permanente)

1. Niciun badge nu se acordă din client. UI-ul care afișează un badge fără gate server-side = refuzat.
2. Retragerea consimțământului `age_verification` → pierde `verified` instant.
3. Ban / suspend → toate badge-urile ascunse (nu șterse din DB).
4. `is_official` DOAR prin `admin_moderate_item`, cu `super_admin` + audit `critical`.
5. Fără "cumpără badge". Premium/Boost sunt vizibile ca marker de plan, nu ca decorație independentă.
