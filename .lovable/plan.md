
# Raport GO-LIVE Ventuza — Discover · Notificări · Play Store

Doar analiză. Zero modificări.

---

## A. GRILA DISCOVER

### A1. Layout & paginare
- **EXISTĂ**: grid fix **3 coloane** (`aspect-square`), toggle Grid ↔ Swipe persistat în `localStorage`. Fișier: `src/routes/discover.tsx` (1672 linii, componenta `Cascade` la linia 859).
- **PARȚIAL**: fetch cu `_limit: 50, _offset: 0` — un singur snapshot; RPC clampează la 50 (`migrations/20260703204411`). Rate-limit 60 apeluri/oră (regula RATE LIMIT DISCOVER).
- **LIPSEȘTE**: infinite scroll / "Load more" / paginare. Layout responsive (4–5 coloane pe tabletă/desktop).

### A2. Cardul
Câmpuri afișate pe card (Cascade): poză principală, `display_name`, vârstă (din `birthdate`), punct verde online, distanță bucketizată, până la 2 tribes, badges (Boost/Now/Travel), unread indicator, BadgeStrip (max 3).
- **RPC `discover_profiles` proiectează** și: `verified`, `gender`, `orientation`, `looking_for`, `bio`, `body_type`, `height_cm`, `weight_kg`, `ethnicity`, `position`, `relationship_status`, `prompts` — folosite doar în ProfileSheet, nu pe card.
- **LIPSEȘTE pe cardul din grid**: bifa `verified` (există în PosterRow, nu în Cascade), text "last seen"/„acum activ", număr de poze.

### A3. Online indicator
- **EXISTĂ**: coloană `profiles.last_seen`, RPC `touch_last_seen()` (`migrations/20260620175816:85`), punct verde pe card când `Date.now() - last_seen < 5 min` (`src/lib/discover.ts:99`).
- **PARȚIAL / bug**:
  - `touch_last_seen` apelat **o singură dată** la mount discover — fără heartbeat periodic → dot devine fals-offline pentru useri activi în alte pagini.
  - Prag inconsistent: client 5 min, RPC `_online_only` 15 min.
  - `setInterval(30s)` doar re-randează, nu face refetch (`discover.tsx:279`).
- **LIPSEȘTE**: heartbeat client global (App-level, nu discover-only), Supabase Presence, respectarea `hide_online` la afișarea punctului verde (RPC returnează `NULL` — clientul nu tratează separat de "offline").

### A4. Reordonare live
- **PARȚIAL**: canal Realtime pe `profile_live_events` (`discover.tsx:313`) → refetch complet debounced 60s.
- **LIPSEȘTE**: upsert incremental (mișcă un card sus când devine online, ca Grindr). Trigger care să populeze `profile_live_events` la schimbări `last_seen` (nu am confirmat existența).

### A5. Filtre
- **EXISTĂ** (FiltersDrawer + QuickFiltersStrip): distanță, vârstă min/max, înălțime, tribes, body type, position, looking-for, gender, orientation, Right Now, Verified, With Photo.
- **PARȚIAL**: `_online_only` există în tipul `DiscoverFilters` și e trimis în RPC, dar **fără toggle în UI** — efectiv inactiv.
- **PARȚIAL**: RPC suportă parametrul `_tab` (`all|online|fresh|photo|now|verified`) — UI trimite mereu `"all"` și face sort local pentru "Fresh".

### A6. Tap pe card
- **EXISTĂ**: deschide `ProfileSheet` fullscreen (bottom sheet), cu swipe și săgeți keyboard, acțiuni Pass/Message/Like, galerie, private album viewer, TapFavoriteRow.
- **LIPSEȘTE**: link/navigare la pagină publică `/u/$slug` (share/copy URL profil).

---

## B. NOTIFICĂRI

### B1. Push
- **EXISTĂ end-to-end Web Push (VAPID)**:
  - Service worker: `public/push-sw.js` (deep-link din `data.url`).
  - Config client: `src/lib/web-push-config.ts` (citește `VITE_VAPID_PUBLIC_KEY` cu fallback hardcodat).
  - Sender server: `src/lib/web-push.server.ts` (`web-push` npm, TTL 24h, auto-prune la 404/410).
  - Server fns: `savePushSubscription`, `sendPushToUser` cu master toggle, per-categorie, quiet hours, discrete mode (`src/lib/push.functions.ts`).
  - Buton `EnablePushButton`.
- **LIPSEȘTE Capacitor nativ (FCM/APNs)**: `@capacitor/push-notifications` nu e configurat în `capacitor.config.ts`. Android/iOS primesc push doar prin browser (Chrome/Safari 16.4+), nu prin FCM nativ.
- **PARȚIAL — push la evenimente**:
  - ✅ Mesaj nou → `sendPushToUser` apelat din `src/lib/chat.ts:73`.
  - ✅ Broadcast partener → `src/lib/partner-broadcasts.functions.ts:173`.
  - ❌ Match / tap / woof → NU trimit push OS. Triggerele DB populează doar tabelul `notifications` → toast in-app.
- **RISC HIGH — cheie VAPID privată hardcodată** ca fallback în `src/lib/web-push.server.ts:17` (`iNOglDe-6dSo…`). Dacă `VAPID_PRIVATE_KEY` nu e în secrets, producția rulează cu cheie publică în repo.

### B2. In-app vizuale
- **EXISTĂ**: 
  - Toast global (Sonner) wired în `__root.tsx:237`, declanșat pe `INSERT notifications` (`notifications-context.tsx:92`).
  - Badge unread messages în `BottomNav` (`useUnreadMessages` hook, realtime debounced 250ms).
  - `NotificationBell` cu glow — **plasat în header, NU în BottomNav**.
  - Pagină istoric `/notifications` cu markRead / markAllRead / delete.
- **LIPSEȘTE**: badge notificări generale în BottomNav (bell), badge matches noi, animație "ramă luminată" pe home, badge pe alte tab-uri.

### B3. Sunet
- **EXISTĂ**: sunet unic "brand" generat Web Audio API (E5→B5 shimmer, 450ms) în `src/lib/notification-sound.ts`. Toggle persist în localStorage, deblocat pe iOS la primul gest.
- **LIPSEȘTE**: sunet distinct per tip (match vs mesaj vs tap).

### B4. Badge count pe tab-uri
| Tab | Badge | Realtime |
|---|---|---|
| Inbox | ✅ unread messages | ✅ (`useUnreadMessages`) |
| Bell (header, nu BottomNav) | ✅ unread notifications | ✅ (`useNotifications`) |
| Discover / Profile / Partner | ❌ | — |

### B5. Realtime
Canale active: `notifications:${uid}`, `unread-msgs-${uid}`, plus canale admin (`risk-flags`, `admin-alerts`, `legal-doc`).
Tabele publicate în `supabase_realtime`: `messages`, `conversations`, `notifications`, `matches`, `taps`, `stories`, `group_messages`, `story_views`, `profiles`, `profile_live_events`, `admin_alerts`, `legal_documents`.
- **OBS**: `matches` și `taps` sunt publicate, dar frontend-ul NU se abonează direct pe ele — vin doar prin `notifications` (trigger DB).

### B6. Gap-uri paritate Grindr
Push nativ FCM/APNs, push la match/tap/woof (nu doar mesaje), badge live matches în BottomNav, sunet distinct per tip, animație vizuală "incoming" pe home, scheduler pentru `event_reminder`.

---

## C. GO-LIVE READINESS (Play Store)

### C1. Build Android
- **EXISTĂ**: `capacitor.config.ts` corect — `appId=app.ventuza.mobile`, `webDir=dist`, plugins `SplashScreen`/`StatusBar`/`PrivacyScreen(preventScreenshots)`. `server.url` activ **doar** dacă `CAPACITOR_DEV=1` → bundling curat la build prod.
- **BLOCKER**: folderul `android/` NU e în repo (per `MOBILE.md`, se generează local cu `npx cap add android`). Trebuie inițializat pe mașina de release.

### C2. Env vars pentru producție
Setate în `.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` + variantele `VITE_*`.

Lipsă / gol:
| Var | Impact | Severitate |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` (gol în `.env`) | Anti-bot dezactivat pe signup | 🔴 BLOCKER |
| `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET` | Age verification (obligatorie) nu pornește | 🔴 BLOCKER |
| `SUPABASE_SERVICE_ROLE_KEY` (de confirmat în Secrets) | Server fns admin, webhooks, billing eșuează | 🔴 BLOCKER |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VITE_VAPID_PUBLIC_KEY` | Fallback hardcodat expus în repo | 🟠 HIGH |
| `REVENUECAT_SECRET_API_KEY` | Cancel abonament la delete cont (GDPR Art.17) eșuează silențios | 🟠 HIGH |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME` | Validare purchase token — billing inoperabil | 🟠 HIGH |
| `LOVABLE_API_KEY`, `LOVABLE_SEND_URL` | AI Copilot admin + email transacțional | 🟡 MEDIUM |
| `HEALTH_COL_KEY` | de confirmat în secrets | ❓ verificat |

### C3. Erori typecheck / build
Fără `@ts-ignore`/`@ts-expect-error` în `src/`. Un cast suspect: `src/routes/messages.$id.tsx` folosește `to: "n" as never` — rută posibil invalidă la runtime, de verificat.

### C4. Hardcodări
- ✅ `server.url` Lovable — corect gated pe `CAPACITOR_DEV`.
- 🟠 `og:image` din `src/routes/__root.tsx:125,130` = screenshot preview Lovable (URL R2 conține `id-preview-…lovable.app`). Branding incorect pentru share și listing.
- 🟠 VAPID private key fallback hardcodat (`web-push.server.ts:17`).
- ✅ Referințele lovable din `age-gate-policy.ts` sunt logica de excludere (corect).

### C5. Feature flags
- `age_verification` — forțat ON în producție prin `age-gate-policy.ts` (kill-switch inactiv pe prod host). ✅
- `demo_seed` — butoanele sunt disabled în prod via `isProductionHost()`; `DemoSeedBanner` avertizează dacă apar `is_seed=true` pe prod. ✅ UI dezactivat.
- **Recomandat**: query manual `SELECT flag_key, enabled FROM public.feature_flags` înainte de lansare (n-am putut confirma toate flag-urile live).

### C6. Cod mort / schelet vizibil
- 🟡 `VerificationQueuePanel` — marcat DEPRECATED, dar apare în nav admin fără `adminOnly` (`admin.tsx:439`), cu badge counter `pendingVerif` care poate afișa număr eronat. De ascuns sau marcat `hidden`.
- ✅ `DemoSeedPanel` — gated `adminOnly` + disabled în prod.
- ✅ `/verify` — activ, necesar (flow Didit).
- ✅ Simulator locație — `super_admin` + dezactivat în prod.

---

## CHECKLIST GO-LIVE PLAY STORE

### 🔴 BLOCKER
- B1: Generat folder `android/` local (`npx cap add android`).
- B2: `SUPABASE_SERVICE_ROLE_KEY` confirmat în Lovable Secrets prod.
- B3: `DIDIT_API_KEY` + `DIDIT_WORKFLOW_ID` + `DIDIT_WEBHOOK_SECRET` în Secrets.
- B4: `VITE_TURNSTILE_SITE_KEY` setat (acum gol în `.env`).

### 🟠 HIGH
- H1: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` în Secrets — elimină fallback hardcodat.
- H2: `REVENUECAT_SECRET_API_KEY` în Secrets.
- H3: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `GOOGLE_PLAY_PACKAGE_NAME` în Secrets.
- H4: `og:image` real de brand (nu screenshot preview Lovable).
- H5: Push OS la match / tap / woof (nu doar mesaje).
- H6: Ascunde/marchează `hidden` `VerificationQueuePanel` din nav admin.
- H7: Respectă `hide_online` la afișarea punctului verde pe card (privacy).

### 🟡 MEDIUM
- M1: Heartbeat periodic `touch_last_seen` la nivel de App (nu doar la mount discover).
- M2: Unifică pragul "online" client 5 min ↔ RPC 15 min.
- M3: Toggle "Online only" în UI FiltersDrawer.
- M4: `LOVABLE_API_KEY` + `LOVABLE_SEND_URL` în Secrets.
- M5: Query manual `feature_flags` înainte de lansare.
- M6: Verifică ruta suspectă `to: "n" as never` din `src/routes/messages.$id.tsx`.
- M7: Capacitor nativ FCM/APNs (paritate reală iOS/Android).
- M8: Badge matches noi în BottomNav; sunet distinct per tip; animație vizuală incoming.
- M9: Layout Discover responsive (4–5 coloane desktop/tablet) + paginare/infinite scroll.
- M10: Link `/u/$slug` din ProfileSheet pentru share.

---

Spune-mi care bucket vrei să atac primul (BLOCKER-urile de secrets/env vs UX Discover vs push nativ) și trec direct în build.
