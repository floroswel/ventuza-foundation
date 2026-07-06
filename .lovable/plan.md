# Raport — cum funcționează LOCAȚIA în Ventuza (read-only)

Zero modificări. Harta completă a implementării actuale.

---

## 1. Când & unde se cere permisiunea de locație

**Status: implementat, în 2 straturi. Nu există pas de onboarding pentru locație.**

- **Strat primar — primer după login** (`src/components/LocationPermissionPrompt.tsx`, montat global din `src/routes/__root.tsx:232`). Se declanșează **o singură dată per user**, doar dacă:
  - `profiles.location_sharing_enabled === true` (default true),
  - `navigator.permissions.query({name:'geolocation'})` returnează `"prompt"` (browserul nu a decis încă),
  - country gate nu forțează stealth/blocare.
  Marchează în `localStorage` (`ventuza_loc_prompt_seen_v1:<uid>`), deci nu re-apare.
- **Strat secundar — la intrarea în `/discover`** (`src/routes/discover.tsx:159-184` → `requestAndStoreLocation()` din `src/lib/discover.ts:126`). Cere din nou `getCurrentPosition`. Dacă permisiunea e deja `granted`, e silențios; dacă e `denied`, arată un toast one-shot.
- **Onboarding (`/n`)**: **NU conține niciun cod de geolocație**.

---

## 2. Cum se captează coordonatele

**Status: doar browser Web API. NU există plugin Capacitor Geolocation.**

- `capacitor.config.ts` listează doar SplashScreen / StatusBar / PrivacyScreen.
- `package.json` nu are `@capacitor/geolocation`.
- Toate cele 5 call sites folosesc `navigator.geolocation`:

| Call site | Fișier | API | Mod |
|---|---|---|---|
| First-run primer | `LocationPermissionPrompt.tsx:81` | `getCurrentPosition` | one-shot |
| Discover entry | `discover.ts:131` | `getCurrentPosition` (high acc → low acc) | one-shot |
| Session background | `SessionGuards.tsx:86` | `watchPosition` (throttle 15s) | continuu |
| Nearby + proximity | `geo-bucket.ts:64` + `watchSignificantMovement` (250m) | mix | threshold |

---

## 3. Storage

**Server-side (PostGIS):**
- Coloană: `profiles.location` (tip `geography`, SRID 4326).
- Coloane înrudite: `profiles.travel_location`, `profiles.prev_location`, `profiles.prev_location_at`, `profiles.last_seen`.
- RPC unic de scriere: `public.update_my_location(lng, lat)` — `SECURITY DEFINER`, forțează `WHERE id = auth.uid()`. Setează și `last_seen = now()`.

**Client-side:**
- `geo-bucket.ts:36` — variabilă modul cu TTL 60s.
- **Explicit NU se persistă în `localStorage`.** Doar în memorie.

---

## 4. Calculul distanței

**Split pe două suprafețe:**

**a) User ↔ user (Discover/Swipe) — 100% server-side PostGIS**
- Migrare: `20260624220659_*.sql`.
- `discover_profiles` calculează intern `ST_Distance(viewer_loc, p.location)` dar **nu returnează valoarea raw**. Proiectează doar `public.bucket_distance_m(dist_m)`.
- `bucket_distance_m` mapează metri la trepte discrete: <1km→500, <3km→2000, <5km→4000, <10km→8000, <25km→20000.
- **Clientul NU face niciodată Haversine între doi useri.**

**b) User ↔ POI (venue/event) — Haversine în client**
- `nearby.tsx:176`, `proximity-watcher.ts:87` folosesc `distanceMeters` din `geo-bucket.ts`.
- Permis: coordonatele venue/event sunt publice. Serverul primește doar `bucketId` (celulă ≈5.5km), nu coordonatele userului.

---

## 5. Unde se afișează distanța în UI

**a) Distanță de user (bucketizată):**
- Funcție: `formatDistance` din **`src/lib/discover.ts:87-97`** → `"< 1 km"`, `"~ 2 km"`, `"~ 4 km"`, etc.
- Randare:
  - `src/routes/discover.tsx:937` (grid card)
  - `src/routes/discover.tsx:1032` + `SwipeCard.tsx:142` (swipe)
  - `src/routes/discover.tsx:1188` (drawer full)
  - `QuickProfileDrawer.tsx` (drawer rapid)

**b) Distanță de venue/event (exactă):**
- Funcție diferită: `formatDistance` din **`src/lib/geo-bucket.ts:30`** → `"290m"`, `"1.2km"`.
- Randată în `src/components/nearby/NearbyCard.tsx:97`.

⚠️ **Trap:** două funcții cu același nume în module diferite.

---

## 6. Refresh & "last update"

- **Watch continuu**: `SessionGuards.tsx:86` — `watchPosition` cu throttle 15s pe toată sesiunea. Fiecare update cheamă `update_my_location` (setează și `last_seen = now()`).
- **Movement threshold**: `watchSignificantMovement(250m)` în `/nearby` și proximity watcher.
- **Feed refresh**: `discover.tsx:290-325` ascultă realtime Postgres channel `profile_live_events`, debounce minim 60s. Fără `setInterval` pentru fetch.
- **Online status**: `setInterval(30s)` doar pentru re-evaluare `isOnline()`.
- **Background sync**: **INEXISTENT** — fără Service Worker geo, fără Capacitor Background Geolocation.

---

## 7. Fallback la refuz permisiune

**Status: parțial.**

1. Primer denied → setează `location_sharing_enabled=false` + marchează seen; toast: „Poți activa mai târziu din Profil".
2. `/discover` → `locStatus="denied"`, toast one-shot. **Grid rămâne funcțional** (SQL permite `dist_m IS NULL`). Distanța se afișează ca `"În apropiere"`.
3. **IP fallback**: `useCountryRisk.ts:21` cheamă `ipapi.co/country/` — dar DOAR pentru country gate (stealth/blocked), NU pentru proximitate useri.
4. `/nearby` → afișează `geoError` cu buton „Reîncearcă"; harta+lista ascunse.

⚠️ **Lipsă**: fără CTA persistent în grid când locația e refuzată — doar toast unic.

---

## 8. Privacy / fuzzing

**Corect (conform REGULĂ LOCAȚIE din AGENTS.md):**
- `public.bucket_distance_m` — singura sursă de bucketizare.
- `profiles.location` **nu se proiectează niciodată** brut către alți useri.
- `nearby_points` întoarce `lat/lng` — permis (venue/event, date publice).
- Haversine client — folosit doar pentru user↔venue și user↔propriul punct anterior.

**Concerne:**
1. Numele câmpului `distance_m` în RETURNS TABLE sună a raw (deși e bucketizat).
2. Overload legacy `discover_profiles` (`20260621003650_*`) returnează încă `hiv_status`, `hiv_test_date` plaintext — violare separată (date sănătate).
3. Două `formatDistance` cu semantici diferite — trap pentru dev viitor.

---

## Inventar fișiere implicate

**Componente / rute:**
- `src/components/LocationPermissionPrompt.tsx`
- `src/components/SessionGuards.tsx`
- `src/routes/discover.tsx`
- `src/routes/nearby.tsx`
- `src/components/SwipeCard.tsx`, `QuickProfileDrawer.tsx`, `nearby/NearbyCard.tsx`, `nearby/NearbyMap.tsx`

**Librării client:**
- `src/lib/geo-bucket.ts` — wrapper geolocation + Haversine + cache
- `src/lib/discover.ts` — `requestAndStoreLocation`, `fetchDiscover`, `formatDistance` (bucket)
- `src/lib/nearby.functions.ts`
- `src/lib/proximity-watcher.ts` + `src/lib/proximity.functions.ts`
- `src/lib/country-gate.ts` + `src/hooks/useCountryRisk.ts`

**Migrări SQL:**
- `20260620175816_*` — `update_my_location`
- `20260624220659_*` — `bucket_distance_m`, `discover_profiles` (nou)
- `20260626231200_*` — `nearby_points`

---

## Rezumat implementat vs. lipsă

**Implementat corect:**
- Primer permission post-login + fallback la Discover.
- Storage PostGIS `geography`.
- Bucketizare SQL centralizată.
- Coords NU pleacă la server pentru user↔user.
- Client cache doar memorie, 60s TTL.
- Toggle privacy funcțional.
- Country gate.

**Parțial:**
- Travel mode (coloană DB, fără UI).
- Refresh discover (realtime + debounce, fără reorder live).
- Fallback UX când permisiune refuzată (toast unic).
- Overload-uri SQL duplicate pentru `discover_profiles`.

**Lipsă:**
- Actualizare locație în background.
- UI „ultima actualizare locație" în Discover (există doar în Profil).
- UI Travel mode.
- CTA persistent în grid la locație refuzată.
- Reorder live al grid-ului.

**Traps:**
- Două `formatDistance` cu semantici diferite.
- Numele câmpului `distance_m` sună a raw.
- Overload legacy `discover_profiles` cu date HIV plaintext (problemă separată).
