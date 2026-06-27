
# AUDIT UX CAP-COADĂ — RAPORT BRUTAL

Sursă: două audituri read-only paralele, fiecare cu dovezi `file:linie`.

---

## CĂLĂTORIA 1 — USER NOU (dating)

| Pas | Rută / fișier | Verdict |
|---|---|---|
| 1. Landing | `index.tsx`, `AgeGate.tsx` | ⚠️ flash de spinner pe cold load la vizitatori |
| 2. Signup email + OAuth | `auth.tsx` | 🔴 OAuth pe Safari/WebView pierde birthdate din `sessionStorage`; email-confirm = dead end |
| 3. Onboarding /n (6 pași) | `n.tsx` | 🔴 `PhotosStep` uploadează FĂRĂ moderare AI (ocolește `moderatePhoto`) |
| 4. Consimțăminte | `consent-registry.ts`, `ConsentPromptHost.tsx` | ⚠️ push & background_location nu se cer proactiv |
| 5. Discover prima dată | `discover.tsx`, RPC `discover_profiles` | ⚠️ eroare RPC indistinguibilă de empty real |
| 6. Swipe→match→chat | `discover.tsx`, `MatchModal.tsx`, `messages.$id.tsx` | ⚠️ buton "Message" pe orice profil; trigger block dă toast opac |
| 7. Profil + poze | `profile.tsx`, `PhotoManager.tsx` | ✅ moderare AI corectă (singurul loc) |
| 8. Nearby/Events/Notifications/Settings | `nearby.tsx`, `events.tsx`, … | 🔴 `nearby.tsx:262` folosește `window.alert()` raw |
| 9. Retenție (daily reward, quests) | `quests.tsx`, `DailyRewardCard.tsx` | 🔴 `quests.tsx:76` are `catch{/*noop*/}` — fail silențios |

---

## CĂLĂTORIA 2 — BUSINESS NOU (partener)

| Pas | Rută / fișier | Verdict |
|---|---|---|
| 1. Intrare în app | `index.tsx:91–103` | ⚠️ card vizibil DOAR pentru vizitatori; userii logați nu pot ajunge la `/business` din nicio pagină |
| 2. Înregistrare | `business.tsx`, `business-apply.functions.ts` | 🔴 `user_id` hardcodat `null` la submit + IBAN absent din formular |
| 3. Post-aplicare DoneScreen | `business.tsx:484–534` | ⚠️ promite "poți pregăti primele postări" — fals (rol lipsește) |
| 4. Portal `/partner` (pending/approved) | `partner.tsx` | ⚠️ aprobarea cere refresh manual fără buton; fără polling/realtime |
| 5. Wizard postare | `PostingWizard.tsx`, `partner-templates.ts` | 🔴 `createSignedUrl(…, 30*24*3600)` — cover photos mor după 30 zile |
| 6. Moderare | `admin-partners.functions.ts:209` | 🔴 zero email/push la decizie; bell montat DOAR pe `/partner` (lipsă pe billing/guide) |
| 7. Facturare OP bancar | `partner.billing.tsx`, `billing.functions.ts:113` | ⚠️ IBAN fără validare format; grace period opac; lipsă banner overdue |
| 8. Puncte moarte | `partner.tsx` ↔ `business.dashboard.tsx` | 🔴 două portale complet disconectate, fără cross-linking |

---

## TOP 12 PROBLEME — DUPĂ GRAVITATE

### 🔴 BLOCKERE (P0)

1. **Onboarding upload poze fără AI moderation** — `n.tsx:518–537`. Conținut NSFW poate intra prin signup. Inconsistență cu `PhotoManager.tsx`.
2. **OAuth birthdate pierdut pe mobil** — `auth.tsx:195`. `sessionStorage` nu supraviețuiește redirect OAuth în Safari/WebView → flux signup mobil rupt.
3. **`createSignedUrl` 30 zile pe cover photos partener** — `PostingWizard.tsx:576`. Toate venue/event/offer cover-urile devin broken după 30 zile, în portal ȘI în Nearby.
4. **`user_id=null` hardcodat la submit business** — `business-apply.functions.ts:63`. Aplicații orfan dacă auth expiră sau context nu se propagă.
5. **Quests `catch{/*noop*/}`** — `quests.tsx:76`. Eroare RPC = listă goală fără feedback. Pierdere engagement.
6. **`window.alert()` în Nearby empty state** — `nearby.tsx:262`. Brut, blocant, neconform.
7. **Email confirm = dead end** — `auth.tsx:157`. Fără resend, fără pagină dedicată, fără countdown. Drop-off masiv post-signup email.
8. **Două portale partener disconectate** — `partner.tsx` (venues/events/offers) vs `business.dashboard.tsx` (ads). Zero breadcrumb, zero cross-link.
9. **Bell notificări status DOAR pe `/partner`** — `StatusNotificationsBell` lipsă pe `/partner/billing` și `/partner/guide`. Niciun layout wrapper.
10. **Fără email la decizia de moderare** — `admin-partners.functions.ts:209`. Bell + polling 1 min = singura cale.

### ⚠️ FRUSTRARE (P1)

11. **Eroare RPC Discover = "No one nearby"** — `discover.tsx:116`. Userul nu distinge eroare de absență reală.
12. **Aprobare partener cere refresh manual fără buton** — `partner.tsx:183`. Text spune "automat", dar nu există polling/realtime.

---

## SPRINT REMEDIERE P0 PROPUS

În ordine de impact, aplicat într-o singură rundă. Fiecare item are dovada în secțiunile de mai sus.

### Track A — Dating safety + activation
1. **Moderare AI la onboarding photos** — în `PhotosStep` (`n.tsx`) refolosește exact pipeline-ul din `PhotoManager.tsx` (apel `moderatePhoto` + perceptual hash) ÎNAINTE de a scrie în storage / `profiles.photos`.
2. **OAuth birthdate persist robust** — la `persistPendingBirthdate`, în loc de `sessionStorage`, scrie birthdate-ul într-o coloană `profiles.pending_birthdate` printr-un server fn apelat înainte de `signInWithOAuth`, iar la `routeAfterAuth` mută în `birthdate` dacă lipsește. Fallback rămâne `sessionStorage`.
3. **Email confirm pagină dedicată** — rută nouă publică `/auth/check-email` cu buton "Resend email" (`supabase.auth.resend({type:'signup'})`) + countdown 60s. `auth.tsx:157` navighează acolo.
4. **Quests: înlocuiește `catch{/*noop*/}`** — `quests.tsx:76` setează `error` în state și randează `ErrorBanner` cu retry (pattern din AGENTS.md ADMIN PANELS, aplicabil global).
5. **Discover: distinge eroare de empty** — `discover.tsx:116` setează `loadError` și `EmptyState` primește prop `variant: "error" | "empty"` cu copy diferit + retry.
6. **Nearby: scoate `window.alert()`** — `nearby.tsx:262` folosește `requestConsent("proximity_notifications", ...)` din registrul existent + toast.
7. **Post-onboarding redirect** — `n.tsx:221` → `/discover` (nu `/profile`).
8. **Push consent proactiv post-match** — la primul match (în `MatchModal` close), dacă `has_active_consent('push_notifications')` e false, prompt `requestConsent` cu rationale "Ca să afli imediat când îți răspunde".

### Track B — Partener experience
9. **Cover photos: public URLs, nu signed** — bucket `venue-media` rămâne privat pentru upload, dar adaugă o cale publică / `getPublicUrl` pentru itemi cu `moderation_status='approved'`; salvează în DB doar `cover_path` (relativ) iar render-ul rezolvă URL-ul. Backfill: re-resolvă pentru rândurile existente.
10. **`user_id` real la submit** — `business-apply.functions.ts:63` folosește `requireSupabaseAuth` opțional (citește `auth.uid()` dacă există token) și setează `user_id` direct; păstrează `linkOrphans` pentru cazul anon. Adaugă apel `linkOrphans` și pe `onAuthStateChange === "SIGNED_IN"` în `__root.tsx`.
11. **Layout `/partner/_layout`** — pathless layout wrapper care montează `StatusNotificationsBell` + breadcrumb partajat pe TOATE sub-rutele `/partner/*`. Adaugă link direct la `/business/dashboard` (ads) și invers.
12. **Polling status aprobare** — în ecranul pending din `partner.tsx`, `useEffect` cu `setInterval(refreshRoles, 15000)` + supabase realtime pe `user_roles` (insert pentru user-ul curent) → auto-reload la aprobare.
13. **Email la moderare** — în `admin_moderate_item` (sau wrapper server fn) trimite email partenerului (template "Postare aprobată / respinsă / cere modificări") prin canalul existent. Bell rămâne.
14. **IBAN validare format** — `billing.functions.ts:113` adaugă regex IBAN ISO 13616 + checksum mod-97; reject la submit.
15. **Banner overdue + timeline grace** — pe `/partner` (layout nou), banner roșu dacă există facturi `overdue`; pe `/partner/billing` afișează "Mai ai N zile până la downgrade" calculat din `grace_until`.
16. **Link "Pentru parteneri" pentru useri logați** — în `/settings` (secțiune nouă "Business") + link în meniul de profil. Cardul din `index.tsx` rămâne.
17. **DoneScreen mesaj onest** — `business.tsx:511` schimbă în "Vei primi email când cererea e aprobată. Între timp poți citi ghidul." + link `/partner/guide`.

### Track C — Cleanup minor (1 oră)
18. Spinner cold load landing — `index.tsx:42` randează landing-ul pentru `!user && loading` (auth check în background).
19. ProfileSheet "Message" — ascunde butonul dacă nu există match (sau redenumește "Trimite tap" pentru pre-match).

---

## DECIZII DE LUAT ÎNAINTE DE BUILD

1. **Email transactional** — există deja un provider configurat (Resend/SMTP via subprocesatori) sau trebuie adăugat? Track B punctele #7 (email moderare) și #4 (email confirm flow) depind de asta.
2. **Bucket `venue-media` public vs signed lung** — preferința e bucket public pentru itemii `approved` (cea mai curată), dar pot face și signed URL 1 an + refresh la render dacă vrei să păstrezi privat.
3. **Scope sprint** — vrei toate cele 19 puncte într-un singur val, sau doar 🔴 P0 (#1–#10) acum și ⚠️ P1 (#11–#19) într-un al doilea?

După aprobare execut Track A + B + C în ordine, cu typecheck la final și raport de diff-uri.
