
# Analiză — GRILA DISCOVER + NOTIFICĂRI (read-only, zero modificări)

Sursă: `src/routes/discover.tsx`, `src/lib/discover.ts`, `src/lib/notifications-context.tsx`, `src/lib/notification-sound.ts`, `src/lib/push.functions.ts`, `src/lib/web-push.server.ts`, `src/lib/web-push-config.ts`, `src/components/EnablePushButton.tsx`, `src/hooks/useUnreadMessages.ts`, `src/lib/chat.ts`, `supabase/migrations/*profile_live_events*`, `public/push-sw.js`.

---

## A. GRILA DISCOVER

### 1. Layout — EXISTĂ (parțial modern)
- `discover.tsx:880` — `grid grid-cols-3 gap-[1px]` → **3 carduri/rând** pe toate breakpoint-urile (nu se lățește pe desktop, nu are `sm:grid-cols-4 lg:grid-cols-5` ca Grindr web).
- **NU există infinite scroll și nici paginare.** RPC `discover_profiles` e chemat cu `_limit: 50, _offset: 0` (`discover.ts:196`), hard-cap server-side 50 (regula anti-scrape). Userul vede maxim 50 profiluri per încărcare; nu există buton "load more".
- Tab-uri: `nearby` / `fresh` (sortare client-side pe `last_seen`) + view alternativă `swipe`.

### 2. Card — ce afișează / ce lipsește
EXISTĂ (`discover.tsx:880-960`): poză (`aspect-square`, semnată prin `signPhotos`), nume + vârstă (`ageFrom(birthdate)`), distanță **bucketizată** (`formatDistance` → "< 1 km", "~ 2 km"…), tribes (2 din listă), badge-uri (`BadgeStrip` — verified etc.), indicator BOOST, indicator NOW ("Looking now"), tag `Plane` cu oraș de călătorie, badge unread mesaje (`snake-border` + count rose).

LIPSEȘTE vs Grindr:
- **Text "Active Xm ago"** pe card — funcția `formatLastSeen` există în `discover.ts:104` dar NU e folosită în grilă (doar în `ProfileSheet:1152`).
- **Distanță precisă în metri** — imposibil (regulă anti-triangulație, corect așa; e o alegere de siguranță, nu un bug).
- **Tag-uri "Looking For" / "Position"** vizibile pe card — datele vin, dar nu se afișează în grilă.
- **Skeleton loading pe card individual** — există doar skeleton global.
- **Story/live ring** în jurul avatarului (Grindr Fresh).

### 3. Indicator online — EXISTĂ, dar șubred
- `discover.tsx:915` randează punct verde emerald cu glow când `isOnline(p.last_seen)` (`discover.ts:98` → prag **5 minute** față de `last_seen`).
- `last_seen` se scrie prin RPC `supabase.rpc("touch_last_seen")` chemat **o singură dată** la mount (`discover.tsx:155`). Nu se face heartbeat periodic → dacă user stă mai mult de 5 min fără să reintre pe Discover, apare offline pentru ceilalți deși e activ.
- **Nu există Supabase Presence** (`.on("presence")`) — nici pe Discover, nici global. Punctul verde e derivat exclusiv din timestamp DB.
- Există canal realtime `profile_live_events` (`discover.tsx:314`) care doar declanșează re-fetch la mișcare de locație — nu e presence real, doar notificare de "s-a schimbat ceva la un profil".

### 4. Reordonare live — PARȚIAL
- Există `setInterval(30_000)` care forțează re-render (`discover.tsx:279`) pentru ca `isOnline` să se reevalueze — dar NU schimbă ordinea, doar recalculează dot-ul.
- Refresh real (`load()`) e triggered de canalul `profile_live_events`, **debounced la 60s** ca să evite `discover_rate_limited`. Deci reordonarea "cineva devine online" apare cu până la 60s întârziere și doar dacă acel user și-a mișcat locația (ce populează `profile_live_events`), NU la simpla revenire.
- **Concluzie:** grid quasi-static; nu ai senzația Grindr de "cineva tocmai a apărut sus".

### 5. Filtre — EXISTĂ complet
`DiscoverFilters` (`discover.ts:3-40`): distanță max, min/max age, `lookingFor`, `gender`, `orientation`, `tribes`, `bodyTypes`, `positions`, height range, `onlineOnly`, `withPhotoOnly`, `verifiedOnly`, `lookingNowOnly`. UI: `FiltersDrawer`. Sortare: `smart` (score) vs `distance` — hardcodat pe `smart` implicit.

### 6. Tap pe card — drawer overlay (nu route)
`ProfileSheet` (`discover.tsx:1083-1440`) — panou lateral custom cu backdrop + swipe la prev/next. Butoane pass / message / like în footer. Nu navighează la un route separat. E ok, dar nu are deep-link partajabil.

---

## B. NOTIFICĂRI

### 1. PUSH — Web Push VAPID FUNCȚIONAL, native FCM/APNs LIPSEȘTE
- **Web Push (browser)**: `EnablePushButton.tsx` înregistrează `/push-sw.js` (`public/push-sw.js` există), obține subscription cu `VAPID_PUBLIC_KEY` (`web-push-config.ts` — env `VITE_VAPID_PUBLIC_KEY` cu fallback hardcodat MVP), salvează prin `savePushSubscription` (`push.functions.ts:12`). Trimitere reală: `sendOne` cu librăria `web-push` folosind `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (`web-push.server.ts`, fallback la MVP dacă env lipsește — **security smell**: fallback la cheie hardcodată în cod).
- **Consimțământ**: `push_notifications` înregistrat în `consent_log` la abonare/dezabonare.
- **Preferințe recipient**: master toggle + per-category (`matches/messages/likes/events/marketing`) + quiet hours + `discrete_mode` (strip preview) — toate respectate în `sendPushToUser`.
- **Native mobil (FCM/APNs prin Capacitor)**: LIPSEȘTE. `@capacitor/push-notifications` NU e în `package.json`. Coloana `push_subscriptions.kind` există și `sendPushToUser` filtrează pe `kind='webpush'` — restul (FCM/APNS) apare doar în UI admin/legal ca text, nu e implementat. `PushHealthPanel` monitorizează canale care nu sunt încă cablate.
- **Triggere**: doar **mesaj chat nou** (`chat.ts:269`, `:347` via `pushNewMessageNotification`). LIPSEȘTE push pe: match nou, like/tap, woof, event RSVP, offer claim, admin broadcast direct la user (broadcast-urile există dar prin alt flux `partner-broadcasts`).

### 2. IN-APP vizuale — EXISTĂ prin `NotificationsProvider`
- `notifications-context.tsx:73` — canal realtime `notifications:{userId}` pe tabela `notifications` (INSERT/UPDATE/DELETE cu filter `user_id=eq.{id}`). La INSERT: toast `sonner` + push local + sunet.
- Match nou: canal separat `matches-{userId}` în `discover.tsx:331` care deschide `MatchModal` full-screen când vine INSERT.
- **LIPSEȘTE**: badge count global pe tab-uri (mesaje necitite sunt calculate în `useUnreadMessages` dar afișate DOAR ca overlay pe cardul discover — nu apar în bottom nav ca număr roșu pe tab Messages). Fără "ramă luminată" pe home.

### 3. SONORE — EXISTĂ (semnătură generată în cod)
- `notification-sound.ts` — Web Audio API generează sunet ~450ms (E5→B5 shimmer). Toggle localStorage. Priming pe primul gest user (iOS/Safari).
- Se joacă la fiecare INSERT în `notifications` (`notifications-context.tsx:93`). **NU se joacă separat la mesaj chat** — depinde de faptul că mesajul chat generează notification row (verificat implicit, dar nu e evident în cod).
- LIPSEȘTE: sunete diferite per categorie (match vs mesaj vs like). Un singur sunet pentru tot.

### 4. Badge count — PARȚIAL
- Bell icon în nav (`NotificationBell.tsx`) afișează `unread` count din `useNotifications()` — EXISTĂ.
- Mesaje: `useUnreadMessages()` returnează `total/bySender/byConversation`. Total afișat pe cardurile discover (overlay `snake-border` + număr). **NU e afișat ca badge pe tab-ul Messages din bottom nav** (verificare grep — folosit doar pe cardurile discover).
- Likes: LIPSEȘTE badge.

### 5. Realtime — Supabase postgres_changes (nu presence)
Canale active:
- `notifications:{userId}` (INSERT/UPDATE/DELETE) — bell + toast + sunet.
- `matches-{userId}` (INSERT) — MatchModal.
- `discover-profiles:{userId}` (`profile_live_events` *) — refresh grid debounced 60s.
- Chat: (nu verificat aici) canal pe `messages` per conversație.
- **Zero `channel.on("presence", ...)` global** — presence Grindr-style nu există.

### 6. Ce lipsește pentru paritate Grindr
- **Native push mobil** (FCM Android + APNs iOS prin Capacitor) — 0% implementat.
- **Presence real** (heartbeat + Supabase Presence) → punct verde curent nu reflectă onlinu real.
- **Badge tab Messages** în bottom nav (număr mesaje necitite).
- **Push pe match/like/tap/woof** — există server fn `sendPushToUser` gata, dar nu e apelat din `social.ts`.
- **Sunet diferențiat** per categorie (opțional).
- **Grid live-reorder** când cineva devine online (necesită presence sau eveniment separat, azi doar refresh la mișcare locație).
- **Infinite scroll** + `_offset` progresiv (dar atenție la rate limit 10 req/oră — necesită regândit contract server).
- **Fallback VAPID hardcodat în cod** — trebuie eliminat înainte de prod real (`web-push.server.ts:17` are `FALLBACK_PRIVATE` = cheie privată în plaintext).

---

## Sumar EXISTĂ / PARȚIAL / LIPSEȘTE

| Zonă | Stare |
|---|---|
| Grilă 3-col cu cards, poze semnate | EXISTĂ |
| Infinite scroll / paginare | LIPSEȘTE (hard-cap 50) |
| Indicator online (punct verde) | PARȚIAL (last_seen fără heartbeat) |
| Presence realtime | LIPSEȘTE |
| Live-reorder online | PARȚIAL (60s debounce, doar la mișcare) |
| Filtre complete | EXISTĂ |
| Card tap → sheet | EXISTĂ (drawer, nu route) |
| Web Push VAPID + service worker | EXISTĂ (fallback keys hardcodate = risc) |
| Native FCM / APNs | LIPSEȘTE |
| Push pe mesaj | EXISTĂ |
| Push pe match/like/tap/woof | LIPSEȘTE |
| Toast + sunet in-app la notif | EXISTĂ |
| Sunete diferențiate | LIPSEȘTE |
| MatchModal realtime | EXISTĂ |
| Badge bell (notificări) | EXISTĂ |
| Badge tab Messages | LIPSEȘTE |
| Quiet hours / discrete / per-category prefs | EXISTĂ |

Aștept confirmare pentru a intra în build mode cu sprint-ul de finisare Discover + Notificări (sau alt scope pe care îl indici).
