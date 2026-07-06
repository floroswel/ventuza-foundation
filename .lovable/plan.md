# Raport — cum funcționează LOCAȚIA în Ventuza (read-only)

Zero modificări. Doar harta completă a implementării actuale, așa cum e în cod astăzi.

---

## 1. Când & unde se cere permisiunea de locație

**Status: implementat, în 2 straturi. Nu există pas de onboarding pentru locație.**

- **Strat primar — primer după login** (`src/components/LocationPermissionPrompt.tsx`, montat global din `src/routes/__root.tsx:232`). Se declanșează **o singură dată per user**, doar dacă:
  - `profiles.location_sharing_enabled === true` (default true),
  - `navigator.permissions.query({name:'geolocation'})` returnează `"prompt"` (browserul nu a decis încă),
  - country gate nu forțează stealth/blocare.
  Marchează în `localStorage` (`ventuza_loc_prompt_seen_v1:<uid>`) după ce userul apasă orice buton, deci nu re-apare.
- **Strat secundar — la intrarea în `/discover`** (`src/routes/discover.tsx:159-184` → `requestAndStoreLocation()` din `src/lib/discover.ts:126`). Cere din nou `getCurrentPosition`. Dacă permisiunea e deja `granted`, e silențios; dacă e `denied`, arată un toast one-shot.
- **Onboarding (`/n`)**: **NU conține niciun cod de geolocație**. Nu se colectează locație în onboarding.

---

## 2. Cum se captează coordonatele

**Status: doar browser Web API. NU există plugin Capacitor Geolocation.**

- `capacitor.config.ts` listează doar SplashScreen / StatusBar / PrivacyScreen.
- `package.json` nu are `@capacitor/geolocation`.
- Toate cele 5 call sites folosesc `navigator.geolocation`:

| Call site | Fișier | API | Mod |
|---|---|---|---|
| First-run primer | `LocationPermissionPrompt.tsx:81` | `getCurrentPosition` | one-shot |
| Discover entry | `discover.ts:131` | `getCurrentPosition` (high acc → low acc fallback) | one-shot |
| Session background | `SessionGuards.tsx:86` | `watchPosition` (throttle 15s) | continuu |
| Nearby page + proximity | `geo-bucket.ts:64` + `watchSignificantMovement` (250m) | mix | threshold |

---

## 3. Storage

**Server-side (PostGIS):**
- Coloană: `profiles.location` (tip `geography`, SRID 4326).
- Coloane înrudite: `profiles.travel_location` (folosită ca fallback viewer location în `discover_profiles`), `profiles.prev_location`, `profiles.prev_location_at`, `profiles.last_seen`.
- RPC unic de scriere: `public.update_my_location(lng, lat)` — `SECURITY DEFINER`, apelabil doar de `authenticated`, forțează `WHERE id = auth.uid()`. Setează și `last_seen = now()`.

**Client-side:**
- `geo-bucket.ts:36` — variabilă modul cu TTL 60s (`cached`).
- **Explicit NU se persistă în `localStorage`** (comentariu la linia 41). Coordonatele rămân doar în memorie.

---

## 4. Calculul distanței

**Split clar pe două suprafețe:**

**a) User ↔ user (Discover/Swipe) — 100% server-side PostGIS**
- Migrare: `20260624220659_*.sql`.
- `discover_profiles` calculează intern `ST_Distance(viewer_loc, p.location)` dar **nu returnează niciodată** valoarea raw. Proiectează doar `public.bucket_distance_m(dist_m)`.
- `bucket_distance_m` mapează metri la trepte discrete: <1km→500, <3km→2000, <5km→4000, <10km→8000, <25km→20000, etc.
- **Clientul NU face niciodată Haversine între doi useri.** `discover.ts:189` doar afișează valoarea bucketizată.

**b) User ↔ POI (venue/event) — Haversine în client**
- `nearby.tsx:176`, `proximity-watcher.ts:87` folosesc `distanceMeters` din `geo-bucket.ts`.
- Permis: coordonatele venue/event sunt publice (business), nu date de user. Serverul primește doar `bucketId` (celulă ≈5.5km), nu coordonatele userului.

---

## 5. Unde se afișează distanța în UI

**a) Distanță de user (bucketizată, label uman):**
- Funcție de format: `formatDistance` din **`src/lib/discover.ts:87-97`** → `"< 1 km"`, `"~ 2 km"`, `"~ 4 km"`, `"~ 8 km"`, `"~ 20 km"`, etc.
- Locuri de randare:
  - `src/routes/discover.tsx:937` (grid card)
  - `src/routes/discover.tsx:1032` + `src/components/SwipeCard.tsx:142` (swipe mode)
  - `src/routes/discover.tsx:1188` (drawer full profile)
  - `src/components/QuickProfileDrawer.tsx` (drawer rapid)

**b) Distanță de venue/event (exactă):**
- Funcție diferită: `formatDistance` din **`src/lib/geo-bucket.ts:30`** → `"290m"`, `"1.2km"`.
- Randată în `src/components/nearby/NearbyCard.tsx:97`.

⚠️ **Atenție/trap pentru dev viitor:** două funcții cu același nume (`formatDistance`) în module diferite. Un import greșit pe user context ar expune metri exacți — este posibilă capcana.

---

## 6. Refresh & "last update"

- **Watch continuu**: `SessionGuards.tsx:86` — `watchPosition` cu throttle 15s (`lastSentRef`) pe toată durata sesiunii autentificate. Fiecare update cheamă `update_my_location` (care setează și `last_seen = now()`).
- **Movement threshold**: `watchSignificantMovement(250m)` folosit în `/nearby` și proximity watcher.
- **Feed refresh**: `discover.tsx:290-325` ascultă realtime Postgres channel `profile_live_events`, cu debounce minim 60s. **Nu există `setInterval` pentru fetch discover** (comentariu explicit la linia 288 că a fost eliminat).
- **Online status**: `setInterval(30s)` doar pentru re-evaluare `isOnline()` pe datele deja încărcate.
- **Background sync**: **INEXISTENT** — nu există Service Worker pentru geo, nu există Capacitor Background Geolocation. Locația se actualizează doar cât app-ul e în foreground.

---

## 7. Fallback la refuz permisiune

**Status: parțial.**

1. Primer denied → `handleDisable` setează `location_sharing_enabled=false` + marchează seen; toast: „Poți activa mai târziu din Profil".
2. `/discover` → `locStatus="denied"`, toast one-shot „Locație indisponibilă — îți arătăm rezultate pe baza filtrelor tale". **Grid rămâne funcțional** (SQL permite `dist_m IS NULL` — profilurile trec fără distanță). Distanța se afișează ca `"În apropiere"` (`discover.ts:88`).
3. **IP fallback**: `useCountryRisk.ts:21` cheamă `ipapi.co/country/` — dar **DOAR pentru country gate** (stealth/blocked), NU pentru proximitate useri. Zero mapping IP→coords pentru distanță.
4. `/nearby` → afișează `geoError` cu buton „Reîncearcă"; harta+lista sunt ascunse.

⚠️ **Lipsă**: nu există CTA persistent în grid când locația e refuzată — doar toast unic. După dismiss, userul nu mai e prompted în-feed.

---

## 8. Privacy / fuzzing

**Ce e corect (conform REGULĂ LOCAȚIE din AGENTS.md):**
- `public.bucket_distance_m` este singura sursă de bucketizare, folosită de ambele overload-uri `discover_profiles`.
- `profiles.location` **nu se proiectează niciodată** brut către alți useri (verificat pe `RETURNS TABLE` din migrări + `src/integrations/supabase/types.ts`).
- `nearby_points` întoarce `lat/lng` — permis (venue/event, date publice).
- `distanceMeters` (Haversine client) folosit **doar** pentru: user↔venue, user↔propriul punct anterior. Nu apare între doi useri nicăieri.

**Concerne / observații:**
1. **Nume `distance_m` în `RETURNS TABLE`**: regula AGENTS.md spune să refuzi orice câmp `distance_m` cu date raw. Aici valoarea e deja bucketizată SQL, dar numele sună a metri raw — poate induce în eroare pe cineva care va adăuga UI nou.
2. **Legacy overload 2 `discover_profiles`** (migrarea veche `20260621003650_*`) returnează încă `hiv_status text, hiv_test_date date` în plaintext — violare separată (date sănătate), dar e semnal că overload-uri vechi coexistă cu cele noi.
3. **Două `formatDistance` cu semantici diferite** (bucket vs. exact) — trap pentru dev viitor (vezi §5).

---

## Inventar complet de fișiere implicate

**Componente / rute**
- `src/components/LocationPermissionPrompt.tsx` — primer geo post-login
- `src/components/SessionGuards.tsx` — `watchPosition` continuu
- `src/routes/discover.tsx` — request + display distanță user
- `src/routes/nearby.tsx` — geo client + POI
- `src/components/SwipeCard.tsx`, `QuickProfileDrawer.tsx`, `nearby/NearbyCard.tsx`, `nearby/NearbyMap.tsx`

**Librării client**
- `src/lib/geo-bucket.ts` — wrapper geolocation + Haversine + cache + `watchSignificantMovement`
- `src/lib/discover.ts` — `requestAndStoreLocation`, `fetchDiscover`, `formatDistance` (bucket)
- `src/lib/nearby.functions.ts` — server fn wrapper `nearby_points`
- `src/lib/proximity-watcher.ts` + `src/lib/proximity.functions.ts` — notificări proximitate POI
- `src/lib/country-gate.ts` + `src/hooks/useCountryRisk.ts` — gate țară + IP fallback

**Migrări SQL relevante**
- `20260620175816_*` — `update_my_location`
- `20260624220659_*` — `bucket_distance_m`, `distance_bucket_label`, `discover_profiles` (overload nou)
- `20260626231200_*` — `nearby_points`

---

## Ce face Grindr și Ventuza NU are (potențiale îmbunătățiri)

| Feature Grindr | Ventuza | Notă |
|---|---|---|
| Cascade grid ordonat live după distanță | Parțial | Reload doar pe realtime events + debounce 60s. Nu reordonează live. |
| „Last active X min ago" pe tile | Da | `formatLastSeen` + dot online (5min). |
| „Location updated X min ago" indicator | **LIPSĂ** | `last_seen` există în DB dar nu e etichetat ca „ultima actualizare locație" în UI (doar în Profil → Privacy după update recent). |
| Distanță exactă în metri | **Prin design NU** | Bucketizată forțat de siguranță LGBTQ+. Nu se schimbă. |
| Location refresh în background | **LIPSĂ** | Fără Service Worker geo, fără Capacitor Background Geolocation. Doar foreground. |
| Travel mode cu override locație | Parțial | Coloană `travel_location` există + folosită în SQL. **Fără UI** pentru setare. |
| Incognito | Da | `profiles.incognito`. |
| Toggle „partajare locație" în Privacy | Da | `profiles.location_sharing_enabled`. |
| Dot „online now" pe tile | Da | 5min threshold, re-check 30s. |
| CTA persistent „enable location" când refuzat | **LIPSĂ** | Doar toast unic, nu în-feed. |

---

## Rezumat: implementat vs. lipsă

**Implementat corect:**
- Primer permission post-login + fallback la Discover.
- Storage server-side PostGIS `geography`.
- Bucketizare SQL centralizată (`bucket_distance_m`).
- Coords NU pleacă la server pentru user↔user (calculul e integral SQL).
- Client cache doar în memorie, 60s TTL.
- Toggle privacy funcțional + trigger pe `location_sharing_enabled`.
- Country gate.

**Implementat parțial:**
- Travel mode (coloană DB, fără UI).
- Refresh discover (realtime + debounce, dar fără reorder live).
- Fallback UX când permisiunea e refuzată (toast unic).
- Overload-uri SQL duplicate pentru `discover_profiles` (unul vechi cu date sănătate plaintext încă existent).

**Lipsă complet:**
- Actualizare locație în background (Service Worker sau Capacitor Background Geolocation).
- UI „ultima actualizare locație" în Discover (există doar în Profil).
- UI Travel mode.
- CTA persistent în grid la locație refuzată.
- Reorder live al grid-ului pe măsură ce userii se mișcă.

**Traps/riscuri:**
- Două `formatDistance` cu semantici diferite (bucket vs. exact) în module diferite.
- Numele câmpului `distance_m` în RETURNS TABLE sună a raw, deși e bucketizat.
- Overload legacy `discover_profiles` cu date HIV plaintext (problemă separată, nu locație).
