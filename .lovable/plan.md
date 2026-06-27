
# Audit UX cap-coadă Ventuza — doar analiză, zero modificări

Două sub-agenți au mers ecran cu ecran prin codul real. Mai jos: fiecare pas marcat ✅/⚠️/🔴 cu `file:line`, apoi topul brutal.

---

## CĂLĂTORIA 1 — USER NOU (dating)

### 1) Prima pagină / AgeGate
- ✅ `index.tsx:27-40` — redirect corect după login (`/discover` sau `/n`).
- ⚠️ `index.tsx:42` — pe `loading` lent → spinner pur, fără branding.
- 🔴 `AgeGate.tsx:90` — `checking || status===null` returnează `null` → **flash de conținut ne-gated** înainte ca blocul să apară (race client).
- ⚠️ `AgeGate.tsx:82-89` — preview Lovable rulează cu enforce=false; producție OK (`age-gate-policy.ts:51`).

### 2) Signup email + OAuth
- ✅ Validări Zod email/parolă + birthdate + checkboxuri 18+/Termeni (`auth.tsx:29-33, 389-436`).
- ⚠️ `auth.tsx:110` — `signupDisabled` corect, dar butonul gri fără explicație inline; userul află de ce abia la submit.
- 🔴 `auth.tsx:146` — `emailRedirectTo:/n` cu hash token; dacă routerul nu procesează hash-ul, userul aterizează pe `/n` fără sesiune → SessionGuards → `/auth` = loop posibil.
- ⚠️ `auth.check-email.tsx:34-36` — fără `?email=` butonul „Retrimite" e disabled fără explicație; refresh = blocaj.
- ⚠️ `SessionGuards.tsx:23-40` — fetch DB la fiecare path → lag/flash pe conexiuni lente.

### 3) Onboarding /n (6 pași)
- 🔴 `n.tsx:123-124` — `step` și `data` strict în state React, **zero persistență**; refresh / kill app pe mobil = restart de la pasul 1.
- ⚠️ `n.tsx:128` — niciun guard pentru `onboarding_completed=true` → user terminat poate reintra pe `/n` și suprascrie profilul.
- 🔴 `n.tsx:540-554` — moderare foto **fail-closed** fără retry/skip; AI Gateway down = signup imposibil.
- ⚠️ `n.tsx:163-180` — INSERT consent_log fără retry; eroare RLS → toast generic, user blocat fără direcție.
- ⚠️ `n.tsx:223` — `navigate` fără `replace:true` → Back duce în onboarding gol.

### 4) Consimțăminte
- ✅ Registry curat (`consent-registry.ts:45-126`), dialog GDPR (`ConsentPromptHost`), nu `window.confirm`.
- ⚠️ `use-consent.ts:46-54` — `ensure()` rulat înainte ca fetch async să termine (`active===null`) → user interogat de două ori.
- 🔴 **Push notifications**: niciun prompt în flow (post-onboarding sau post-match). `EnablePushButton` îngropat în `/settings`. Day-2 retention moare.

### 5) Discover prima dată
- ✅ Location request non-blocking + `loadError` cu retry (`discover.tsx:96-124`).
- 🔴 `discover.tsx:829-840` — EmptyState generic, **nu distinge** zonă goală / filtre stricte / locație refuzată. Niciun CTA util.
- ⚠️ `discover.tsx:369-371` — SwipeDeck cu stack gol = **ecran alb** fără EmptyState.
- ⚠️ Flash `grid` → `swipe` la mount (preferință din localStorage setată în `useEffect`).

### 6) Swipe → Match → Conversație
- ✅ Gesture și animații solide (`SwipeCard.tsx:32-42`), MatchModal cu CTA „Trimite primul mesaj".
- ⚠️ `SwipeCard.tsx:65` — fallback „No photo" text simplu, fără placeholder vizual.
- 🔴 `MatchModal.tsx:141-148` — butonul `Trimite primul mesaj` **fără loading/disabled** → cereri duble dacă RPC e lent; modal rămâne deschis la eroare.
- ⚠️ `messages.$id.tsx:286` — `confirm()` nativ pentru unsend (inconsistent UX, blocat pe unele WebView-uri, interzis de regulile interne).

### 7) Profil propriu
- ⚠️ `profile.tsx` 800+ linii, foarte dens, fără ordine clară de completare post-onboarding.
- ⚠️ Două căi upload+moderare (`PhotoManager` vs `PhotosStep`) → risc divergență.

### 8) Nearby / Events / Notifications / Settings
- ⚠️ `nearby.tsx:44-48` — `(auth as any).profile.is_founder` care nu există → mereu `false`, gating tăcut.
- ⚠️ `events.tsx:39-55` — `load` ca `useMemo` cu side-effects (anti-pattern), risc apeluri duble.
- 🔴 `notifications.tsx:50` — `useNotifications()` fără fallback → crash dacă providerul lipsește în arbore.
- ⚠️ `settings.tsx:43-44` — `exportData({})` poate eșua la validarea server-fn.

### 9) Retenție primele minute
- 🔴 Discover gol = **dead end absolut** (zero seed vizibili, zero global fallback).
- 🔴 Push notifications niciodată cerute → user care închide nu mai revine.
- ⚠️ DailyReward / Quests fără context educațional pentru user nou.

---

## CĂLĂTORIA 2 — BUSINESS NOU (partener)

### 1) Intrarea ca business
- ✅ `index.tsx:93-103` — card B2B explicit pe landing.
- ✅ `settings.tsx:400-411` — link „Devino partener" + Advertise distinct.
- 🔴 `BottomNav.tsx:9-16` — **zero acces la `/partner` din navigarea principală**.
- ⚠️ Card B2B sub „Siguranță & resurse" — possibly fold pe telefoane mici.

### 2) Înregistrare /business
- ✅ ANAF autocomplete OK (`business.tsx:110-135`), submit prin server fn cu admin client, `user_id` din Bearer (`business-apply.functions.ts:57-94`).
- ⚠️ `business.tsx:145-149` — checkboxuri validate UI dar **stripuite** înainte de server; apel direct la fn ocolește consimțământul (risc GDPR minor real).
- ⚠️ Schema validează `website` ca URL dar inputul nu are `type="url"` → erori UX târzii.
- 🔴 `business.tsx:489-540` — DoneScreen anonim: dacă userul creează cont cu **alt email** decât din cerere, aplicația rămâne orfană permanent; `linkOrphanBusinessApps` se face pe email match, fără warning.
- 🔴 `business.tsx:157-159` — `linkOrphans()` doar dacă userul era logat la submit; userul care se loghează ulterior și nu mai revine pe `/business` rămâne cu cerere orfană.

### 3) După aplicare /partner
- ✅ Polling 15s + realtime INSERT pe `user_roles` (`partner.tsx:147-164`).
- ✅ Stările pending/reviewing/needs_info/rejected/approved descrise clar.
- 🔴 `partner.tsx:215-219` — `needs_info` trimite spre **email manual** fără canal în-app, fără mailto pre-completat.
- 🔴 `partner.tsx:249-253` — ID cerere afișat = `slice(0,8)` din UUID; suportul lucrează cu UUID complet → loop emailuri / abandon.
- 🔴 **Cerere orfană post-login**: `/partner` query după `user_id` returnează null, afișează „Aplică pentru cont partener" ca și cum n-ar fi aplicat. Nicio referință localStorage. Duplicat garantat.

### 4) Portal — venue/event/offer + Wizard
- ✅ Wizard 5 pași solid (`PostingWizard.tsx:82-404`), validare template (`partner-templates.ts:334-362`).
- ✅ Ofertele cer venue **aprobat** (`PostingWizard.tsx:130-134`).
- 🔴 `PostingWizard.tsx:574-578` — **signed URL cover TTL 1 an** stocat în DB → **toate imaginile expiră garantat** la 365 zile, zero job de reînnoire. Bombă cu ceas. (Inconsistent cu fix-ul de 5 ani aplicat în `partner.tsx:604`.)
- 🔴 `PostingWizard.tsx:559-584` — upload imagine direct client; submit eșuat = fișier orfan zombie în storage.
- ⚠️ `partner.tsx:377-380` — mesaj „Adaugă întâi un loc" și când ai venues *pending* (nu doar zero venues).
- ⚠️ `PostingWizard.tsx:246` — Offer pasul Location nu pre-populează coordonatele venue-ului ales (rămâne default București).

### 5) Postare → moderare → status
- ✅ `StatusNotificationsBell.tsx:39-51` — refresh 60s, mark-as-read OK.
- ✅ Ghid promite reset moderation la edit (`partner.guide.tsx:174-179`).
- ⚠️ `StatusNotificationsBell.tsx:42-44` — `.catch(silent)` → erori silențioase, bell rupt fără indicare.
- ⚠️ `partner.tsx:341-344` — spinner peste lista existentă (vs înlocuiește), confuzant.
- 🔴 Tab Events/Offers (`partner.tsx:359-364`) **fără spinner local** → fals empty cât rulează fetch-ul.
- ⚠️ **Zero push** pe moderation events — polling 60s doar dacă userul e pe `/partner/*`.

### 6) Facturare /partner/billing
- ✅ Polling 30s facturi pending + toast activare (`partner.billing.tsx:74-97`).
- ✅ Modal OP cu cod plată/IBAN copiabil (`partner.billing.tsx:237-271`).
- ✅ Upgrade disabled dacă `!billingComplete`.
- 🔴 `partner.billing.tsx:64-67` — fetch `bizApp` cu `.eq(status,'approved')`; null → `BillingProfileCard` cu toate datele goale, fără fallback/avertisment.
- 🔴 `partner.billing.tsx:38-39, 108` — **niciun guard auth**; user nelogat → `loading=true` forever = **spinner etern**.
- ⚠️ EUR pe landing `/business` vs **RON** pe billing (`partner.billing.tsx:183-184`) — inconsistență valutară.
- ⚠️ `BillingProfileCard` remount pe schimbarea key → pierde modificări nesalvate dacă `bizApp` vine null și apoi se populează.
- ⚠️ Status `grace` afișat ca badge galben fără explicație (durată, pierderi, reactivare).

### 7) Puncte moarte
- 🔴 `business.dashboard.tsx:159-168` — `/partner` și `/business/dashboard` **complet deconectate**; partener pe Starter cu „Banner Discover" inclus nu știe că trebuie să meargă la URL separat.
- 🔴 `business.dashboard.tsx:83-107` — insert `advertisers` direct din client fără server fn → suprafață RLS + crash silențios dacă READ ≠ WRITE.
- ⚠️ `partner.guide.tsx` accesibil fără guard de rol (inconsistent cu `/partner`).
- ⚠️ Header `/partner` fără BottomNav → portal siloed.

---

## SINTEZĂ — TOP 10 PROBLEME DUPĂ GRAVITATE

| # | Problemă | Severitate | Locație |
|---|----------|-----------|---------|
| 1 | **Discover gol = dead end absolut** (fără seed/global fallback) | 🔴 | `discover.tsx:829-840` |
| 2 | **Onboarding /n fără persistență** — refresh = restart total | 🔴 | `n.tsx:123-124` |
| 3 | **Moderare foto fail-closed** — AI down = signup imposibil | 🔴 | `n.tsx:540-554` |
| 4 | **Push notifications absente din flow** — Day-2 retention pierdut | 🔴 | flow `discover/MatchModal/n` |
| 5 | **Aplicație partener orfană la email mismatch** | 🔴 | `business.tsx:489-540` + `partner.tsx:121-133` |
| 6 | **Signed URL cover TTL 1 an în Wizard** — imagini expiră garantat | 🔴 | `PostingWizard.tsx:574-578` |
| 7 | **`needs_info` partener fără canal în-app + ID trunchiat** | 🔴 | `partner.tsx:215-219, 249-253` |
| 8 | **`/partner/billing` spinner etern pentru nelogați** | 🔴 | `partner.billing.tsx:38-39, 108` |
| 9 | **`/partner` și `/business/dashboard` complet deconectate** | 🔴 | `business.dashboard.tsx:159-168` |
| 10 | **BottomNav fără link partener** + AgeGate flash + MatchModal fără loading + `confirm()` unsend + EUR/RON inconsistent + grace fără explicație | ⚠️ | multiple |

---

**Verdict brutal în 2 fraze:** Codul e tehnic solid și GDPR-conscious, dar UX-ul se rupe în 4 locuri fatale pentru *dating* (Discover gol, onboarding fără persistență, moderare fail-closed, zero push) și 5 locuri fatale pentru *business* (aplicație orfană, TTL 1 an pe imagini, `needs_info` fără canal, spinner etern billing, portaluri deconectate). Toate sunt rezolvabile fără rescriere — doar fix-uri chirurgicale pe puncte specifice.

Spune-mi pe care le închid și în ce ordine. Recomandare default: **Sprint P0 = pozițiile 1-9** (blockers de retention + B2B revenue), **Sprint P1 = poziția 10** (polish).
