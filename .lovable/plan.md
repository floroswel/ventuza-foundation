# Ventuza — Plan complet ca să batem Grindr, Scruff, Hornet, Sniffies, Hinge & co.

Am analizat 16 aplicații (Grindr, Scruff, Jack'd, Hornet, Sniffies, Taimi, Romeo, Growlr, Surge, A4A, Blued, Tinder, Bumble, Hinge, Tango, Chappy). Raportul complet (1.053 linii) e salvat la `/mnt/documents/ventuza-gay-app-competitive-research.md`.

**Concluzia strategică:** Nicio aplicație nu ocupă cadranul *„dark luxury editorial"*. Grindr = utilitar gri. Hinge = rose gold pe crem (heterosexual-friendly). Sniffies = cyberpunk neon. **Spațiul gold-pe-obsidian, ceremonial, editorial este liber** — exact poziționarea Ventuza.

---

## Ce avem deja în Ventuza
Grilă proximity, swipe history, profil de bază (display_name, birthdate, gender, pronouns, orientation, looking_for, interests, prompts, photos, bio), match-uri, blocking, PostGIS distance, filtre (age/distance/looking_for/gender/orientation), Online/Nearby/Fresh tabs, online row stil Tinder, profile sheet.

## Ce LIPSEȘTE (cap-coadă) — sortat după impact

### 🔴 TIER 1 — Table stakes (fără astea nu suntem o aplicație gay serioasă)
1. **Tribes/Tags** — Bear, Cub, Daddy, Jock, Otter, Twink, Wolf, Leather, Geek, Pup, Rugged, Trans, Bi, Clean-cut. Coloana în profil + filtru + chip-uri pe grid.
2. **Stats fizice** — height, weight, body type (Slim/Average/Athletic/Muscular/Stocky/Bear/Husky), ethnicity, hair, eye color.
3. **Position/Role** — Top, Vers Top, Versatile, Vers Bottom, Bottom, Side, Oral, Not sure.
4. **Sexual health** — HIV status (Negative / Negative on PrEP / Positive / Positive Undetectable / Don't know), last test date, safer practices.
5. **Relationship status** — Single, Partnered, Open relationship, Married, Exclusive dating.
6. **Private albums** cu request/unlock (cheie). Bucket separat `private-photos` cu RLS strict.
7. **Travel mode / „Ventuza Passport"** — setezi un oraș, te vezi local acolo 24h.
8. **Incognito / „Obsidian Vault"** — invizibil în grilă, încă poți browse.
9. **Block, hide, report** — pipeline complet (report → moderation table).
10. **Verificare față** — selfie cu gesture; flag `verified` cu badge auriu pe profil.
11. **Last seen detaliat** — „Active now", „5 min ago", „2h ago", „Yesterday", „This week".
12. **Filtre avansate** — tribes, body, position, HIV, height range, online only, with photo only, verified only.
13. **Galerie multi-foto pe profile sheet** — swipeable carousel, nu doar prima poză.

### 🟡 TIER 2 — Diferențiatori
14. **„Right Now" / Gold Signal** — status efemer 1h cu countdown aurit pe tilă + ring radial.
15. **Stories / „Moments"** — conținut 24h cu border gold-shimmer.
16. **Voice intro** — audio 15s înainte de primul mesaj, waveform aurit.
17. **Expiring photos** — „burn after viewing" cu flacără aurie.
18. **Screenshot prevention** + watermark cu username pe foto private.
19. **See who viewed me** (premium).
20. **Read receipts** (premium).
21. **Events directory** — petreceri curate luxury (circuit, dinners, art).
22. **Community lounges** — group rooms tematice (Bears, Leather, Cultural, Travel).
23. **Hartă „Radar"** — vedere alternativă map-first à la Sniffies (toggle).
24. **Match ceremony premium** — full-screen gold particles + haptic chord 3 tap-uri.
25. **Boost** — pay-to-surface cu glow auriu distinct.

### ✨ TIER 3 — Wow factor exclusive Ventuza
26. **The Exhibition** — grilă editorial variable-height (nu uniform 3-col), feature spreads pentru profile premium, intrare stagger pe coloane.
27. **Noir album reveal** — cortină neagră cu margine gold-shimmer la unlock.
28. **Golden Hour** — fereastră zilnică 18-20h cu warm color shift, badge „Golden Hour" pe match-uri.
29. **Gentlemen's Filter** — ML soft-deprioritization pt. bios/mesaje toxice.
30. **Ventuza Concierge** — tier ultra-premium $149/mo (mai târziu).
31. **AI relevance** — învață preferințele și surfaceaza „cine vibe-uiește cu tine".

---

## Plan de implementare — propunere pe sprinturi

### Sprint 1 (ACUM, fără confirmare suplimentară dacă aprobi)
**Profil bogat + filtre + verificare + private albums + galerie multi-foto**
- Migrare DB: adaug coloane `tribes[]`, `body_type`, `height_cm`, `weight_kg`, `ethnicity`, `position`, `hiv_status`, `hiv_test_date`, `relationship_status`, `verified_at`, `incognito` pe `profiles`.
- Tabele noi: `private_albums`, `album_unlocks`, `reports`, `photo_views`.
- Bucket nou `private-photos` cu RLS strict (doar owner + unlocked viewers).
- Update `onboarding.tsx` și `profile.tsx` cu toate câmpurile noi (chip-uri gold-on-dark, secțiuni colapsabile, accordions).
- Update `discover_profiles` RPC: tribes/body/position/HIV/height filters + scoring care include shared tribes.
- Update `FiltersDrawer` cu noile filtre + slider height + toggle „verified only" / „with photo".
- Update `ProfileSheet`: carousel cu toate pozele, secțiuni Stats / Tribes / Health / Looking for / Prompts.
- Badge auriu „Verified" peste tile + ring auriu la online.
- Last seen formatter detaliat („Active now", „5m", „2h", „Yesterday").

### Sprint 2
**Gold Signal + Match Ceremony + Stories + Voice Intro + Incognito**
- Tabel `gold_signals (user_id, expires_at)` + animație radial-pulse pe tilă în grilă.
- Match Ceremony: full-screen overlay cu particule aurii (canvas), 2.5s, skippable, haptic.
- Tabel `moments` (stories 24h) + bar orizontal cu ring auriu deasupra Online row.
- Voice intro: storage bucket `voice-intros`, MediaRecorder API, waveform SVG gold, redare în Profile Sheet și în primul mesaj din chat.
- Toggle Incognito: când activ, RPC `discover_profiles` te exclude din rezultatele altora; tu vezi tot. Badge „Obsidian Vault" în setări.

### Sprint 3
**Travel/Passport + Events + Radar map + Boost + Premium gating**
- „Ventuza Passport": column `travel_location geography` + UI „Set destination" cu city cards editoriale (foto + text).
- Events: tabel `events` cu cover, location, datetime, RSVP; pagină dedicată `/events`.
- Radar map: pagină `/radar` cu MapLibre + pin-uri pulsante gold (privacy: fuzz location 200-500m, nu coord exact).
- Boost: tabel `boosts (user_id, started_at, duration)` + glow auriu + sortare prioritară 30min.
- Subscription tier (`free` / `gold` / `obsidian`) — gating UI; integrarea plății separat.

### Sprint 4
**Lounges + Expiring photos + Screenshot prevention + See viewers + Golden Hour + Exhibition layout + AI relevance**
- Restul wow factor + Exhibition variable grid (Masonry layout cu featured spreads la fiecare 8 tile-uri).

---

## Decizii tehnice cheie

- **Animații:** Framer Motion pentru ceremony moments + spring cards. Canvas pentru particule aurii. CSS keyframes pentru shimmer.
- **Voice/audio:** MediaRecorder Web API + Supabase Storage. Waveform: peaks pre-calculate la upload, randate SVG.
- **Hartă:** MapLibre GL (gratuit, fără API key) + tile dark vector (Stadia Alidade Smooth Dark sau Carto Dark Matter).
- **Verificare:** flow simplu — selfie + gesture (smile / wink). Manual approve initial, ML mai târziu.
- **Privacy hartă:** location fuzz 200-500m server-side înainte să trimitem coordonate clientului.
- **Realtime:** Supabase Realtime pe `gold_signals`, `moments`, `matches`, `photo_views`.
- **Premium gating:** coloană `tier` pe profiles, helper `useTier()` + componentă `<PremiumGate>`.

---

## Întrebare pentru tine
Confirmă cu **GO Sprint 1** și încep imediat cu profil bogat + filtre + verificare + albume private + galerie multi-foto + last seen detaliat (cea mai mare valoare per efort, deblochează tot restul). Sau spune-mi pe care sprint vrei să prioritizez primul.
