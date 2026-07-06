
# Raport NOTIFICĂRI — stare reală (read-only, zero modificări)

Investigat: `src/lib/push.functions.ts`, `src/lib/web-push.server.ts`, `src/lib/web-push-config.ts`, `src/lib/notifications-context.tsx`, `src/lib/notification-sound.ts`, `src/lib/notifications.ts`, `src/lib/chat.ts`, `src/lib/social.ts`, `src/hooks/useUnreadMessages.ts`, `src/components/EnablePushButton.tsx`, `src/components/NotificationBell.tsx`, `src/components/MatchModal.tsx`, `public/push-sw.js`, `package.json`, migrări `push_subscriptions` + `profile_live_events`.

---

## PUSH

### 1. Web Push (VAPID) — EXISTĂ, FUNCȚIONAL
- Client: `src/components/EnablePushButton.tsx` → înregistrează `/push-sw.js`, cere permisiune Notification, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, trimite la `savePushSubscription`.
- Server fn: `src/lib/push.functions.ts`
  - `savePushSubscription` (POST) — upsert în `push_subscriptions` cu auto-repair pe conflict endpoint (șterge orfane cu `supabaseAdmin`) + `record_consent('push_notifications')`.
  - `removePushSubscription` (POST) — șterge + retrage consent.
  - `sendPushToUser` (POST) — respectă `notification_prefs` (master, per-category, quiet hours, `discrete_mode`), livrare per subscription via `sendOne`.
- Sender: `src/lib/web-push.server.ts` — librăria `web-push` (npm), `sendOne` prinde 404/410 → marchează endpoint expirat, apelantul șterge din DB.
- Service worker: `public/push-sw.js` există (worker dedicat, scope propriu, NU e atins de `pwa-register.ts`).

### 2. Cheile VAPID — PARȚIAL (env vars cu FALLBACK HARDCODAT — risc de securitate)
`web-push.server.ts:17-19`:
```
const FALLBACK_PUBLIC  = "BOO0M7jilN8SYJCu...EpABto";
const FALLBACK_PRIVATE = "iNOglDe-6dSogIb1DeNo-mqlEJWZq7zdBzZPORilfvk";  // ← PRIVATE key în plaintext
const FALLBACK_SUBJECT = "mailto:hello@ventuza.app";
```
Runtime citește `process.env.VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT`, dar dacă env lipsește **cade pe fallback hardcodat**. Cheia privată e commit-ată în cod → oricine cu acces la sursă poate trimite push în numele Ventuza. **CRITIC de rezolvat înainte de prod.**

Client: `web-push-config.ts` — `VITE_VAPID_PUBLIC_KEY` (env) cu același fallback public (OK, cheia publică poate fi commit-ată).

### 3. Push Android/iOS via Capacitor (FCM/APNs) — LIPSEȘTE
- `@capacitor/push-notifications` **NU e în `package.json`**. Există alte plugin-uri Capacitor (`@capacitor/android`, `@capacitor/app`, `splash-screen`, `status-bar`, `@revenuecat/purchases-capacitor`) — nimic pentru push nativ.
- `push_subscriptions.kind` are valori `webpush` populate, dar `sendPushToUser` filtrează `if (s.kind !== "webpush") continue;` — deci chiar dacă ar exista o subscription FCM/APNs, nu s-ar trimite.
- Referințele "FCM/APNs" există doar în copy legal (`legal.privacy.tsx`, `legal.data-safety.tsx`), în admin panel (`PushHealthPanel.tsx` — placeholder monitorizare) și în text consent — **zero implementare reală**.

### 4. Tabel `push_subscriptions` — EXISTĂ, se populează
Coloane cheie: `user_id`, `endpoint`, `p256dh`, `auth`, `platform`, `kind`, `fcm_token` (legacy NOT NULL — reused ca endpoint), `last_seen_at`, `user_agent`. RLS activ (4 policies). Se populează la fiecare abonare din `EnablePushButton`. Service worker `/push-sw.js` — există în `public/`.

### 5. Când se trimite push efectiv — DOAR pe mesaj chat nou
- `src/lib/chat.ts:53` `pushNewMessageNotification` → apelat la fiecare mesaj trimis (`chat.ts:269, :347`) → `sendPushToUser({ category: "messages", ... })`.
- **LIPSEȘTE push pe**: match nou, like/swipe, tap, woof, favorite, view profil, event RSVP, offer claim, admin broadcast targeted, story view. `src/lib/social.ts` NU cheamă `sendPushToUser` nicăieri. Match-ul are doar realtime in-app (MatchModal), fără push.
- Broadcast-uri partener (`partner-broadcasts.functions.ts`) au flux separat propriu.

---

## IN-APP

### 6. Toast la mesaj/match/like live — PARȚIAL
- **Notificări (tabelul `notifications`)**: `NotificationsProvider` (`src/lib/notifications-context.tsx:73`) ascultă canal `notifications:{userId}` (INSERT/UPDATE/DELETE cu filter `user_id=eq.{id}`). La INSERT → `toast(title, { description: body })` cu `sonner` + sunet + dedup pe `id`.
- **Match live**: canal separat `matches-{userId}` în `src/routes/discover.tsx:331` → deschide `MatchModal` full-screen (nu doar toast).
- **Mesaje chat live cât ești în app**: nu văd toast dedicat mesajelor primite când NU ești pe ruta chat (verificare: `chat.ts` are canal per conversație, dar toast-ul global depinde exclusiv de existența unui `notifications` row creat pentru mesaj). **PARȚIAL** — dacă backend inserează un `notifications` row pe mesaj, apare toast; dacă nu, ești orb la mesajele primite pe alte rute.
- **Likes**: dacă serverul inserează row în `notifications` cu `type='like'`, apare toast. Altfel nimic.

### 7. Badge count pe taburi — PARȚIAL
- `NotificationBell.tsx` (bell icon în nav) afișează `unread` din `useNotifications()` — **EXISTĂ**.
- `useUnreadMessages()` (`src/hooks/useUnreadMessages.ts`) returnează `total / bySender / byConversation`. Consumat pe cardurile discover ca overlay (rose count + `snake-border`), dar **NU afișat ca badge pe tab-ul Messages din bottom nav**. → **LIPSEȘTE badge Messages pe nav.**
- **LIPSEȘTE badge pentru likes** pe tab-ul Favorites/Likes.

### 8. "Ramă luminată" pe home — PARȚIAL
- Există efectul `snake-border` (CSS) aplicat pe cardurile discover când `unread > 0` pentru senderul respectiv. Grindr-style border curcubeu.
- NU există echivalent la nivel de nav/tab (ex: bottom nav highlight când vin mesaje noi în background). NU există glow pe home layout.

### 9. Realtime — canale Supabase active
| Canal | Sursă | Eveniment | Reacție |
|---|---|---|---|
| `notifications:{userId}` | `notifications-context.tsx` | INSERT/UPDATE/DELETE `notifications` | toast + sunet + update bell |
| `matches-{userId}` | `discover.tsx:331` | INSERT `matches` | MatchModal full-screen |
| `discover-profiles:{userId}` | `discover.tsx:314` | INSERT `profile_live_events` | refresh grid (debounced 60s) |
| Chat conversation | `chat.ts` (nu detaliat aici) | INSERT `messages` per conv | update chat UI |
| Unread messages | `useUnreadMessages.ts` | (verificare separată) | recalcul badge |

**Zero `.on("presence", ...)`** — presence real Grindr-style lipsește complet.

---

## SONORE

### 10. Sunet la notificări — EXISTĂ (generat în cod, nu fișier audio)
- `src/lib/notification-sound.ts` — Web Audio API generează sunet ~450ms (E5 → B5 cu shimmer octavă, envelope soft, low-pass filter). ZERO fișier audio extern.
- Toggle: `localStorage['ventuza:notification-sound']` (default: ON).
- Priming: `primeNotificationSound()` chemat în `NotificationsProvider` la mount → deblochează AudioContext la primul gest user (cerință iOS/Safari).
- Se joacă la fiecare INSERT în `notifications` (`notifications-context.tsx:93`), dedup pe `id`.
- **LIPSEȘTE**: sunete diferite per categorie (match vs mesaj vs like — toate au același sunet). Nu există sunet separat pentru match care să fie mai proeminent.
- **LIPSEȘTE**: sunet in-app la mesaj chat primit dacă nu s-a creat notification row (depinde de backend).

---

## Sumar EXISTĂ / PARȚIAL / LIPSEȘTE

| Item | Stare |
|---|---|
| Web Push VAPID + service worker | EXISTĂ (fallback keys hardcodate = risc) |
| Cheia privată VAPID hardcodată în cod | **CRITIC — fix necesar** |
| Native FCM (Android) / APNs (iOS) | LIPSEȘTE |
| Tabel `push_subscriptions` populat | EXISTĂ |
| Push pe mesaj chat | EXISTĂ |
| Push pe match / like / tap / woof / favorite | LIPSEȘTE |
| Push admin broadcast targeted | LIPSEȘTE |
| Toast in-app pe `notifications` INSERT | EXISTĂ |
| MatchModal realtime | EXISTĂ |
| Toast garantat pe mesaj chat cross-route | PARȚIAL (depinde de `notifications` row) |
| Badge bell notificări | EXISTĂ |
| Badge Messages pe bottom nav | LIPSEȘTE |
| Badge likes | LIPSEȘTE |
| Snake-border unread pe carduri discover | EXISTĂ |
| Sunet generat Web Audio | EXISTĂ |
| Sunete diferențiate per categorie | LIPSEȘTE |
| Presence Supabase (`.on("presence")`) | LIPSEȘTE |
| Quiet hours / discrete mode / per-category prefs | EXISTĂ |

---

## Cel mai CRITIC pentru retenție

1. **VAPID_PRIVATE_KEY hardcodată în `web-push.server.ts:18`** — nu e feature de retenție dar e blocker de securitate. Trebuie eliminat fallback-ul înainte de orice go-live.
2. **Push pe MATCH și pe LIKE** — motorul emoțional al app-urilor de dating. Astăzi userul primește push doar la mesaj efectiv trimis; ratează 80% din "hook events". Server fn `sendPushToUser` există gata, doar cablarea lipsește în `social.ts` (like → match + like unilateral, favorite, tap, woof).
3. **Native FCM/APNs** — fără asta app-ul Capacitor Android nu primește push când e închis (Web Push funcționează în browser Chrome Android, dar în WebView Capacitor comportamentul e inconsistent). Blocker pentru retenție mobile reală.
4. **Badge Messages pe bottom nav** — signal vizual constant "ai mesaje noi" chiar când toast-ul a dispărut. Hook simplu de retenție, cost mic (`useUnreadMessages` deja returnează totalul).
5. **Presence real** — punct verde curent minte (5min prag pe `last_seen` fără heartbeat). Fără presence, "cine e activ acum" e nesincer și scade încrederea în app.

Aștept confirmare pentru sprint de execuție (recomand ordine: VAPID fix → push pe match+like → badge Messages → presence heartbeat → native FCM/APNs Capacitor).
