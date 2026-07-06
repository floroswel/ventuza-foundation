## PROFIL — Raport de stare (analiză, zero modificări)

### A. PROFIL AFIȘAT (ce vezi la altcineva)

**Două suprafețe distincte** care randează profilul altui user:

**A1. `ProfileDrawer` (inline în `src/routes/discover.tsx` liniile ~1189–1378)** — sheet full-screen din grilă/swipe/nearby. Este suprafața principală folosită pe zi.
- Hero: `ProfilePhotoGallery` (poze swipeable) cu overlay: nume, vârstă, badge Verified, punct online + last-seen, distanță bucketizată, înălțime.
- `MatchScoreBadge` sub titlu.
- `TagBlock "Tribes"` (chip gold).
- Grid 2 coloane "Stats": Body, Position, Ethnicity, Weight, Relationship status. (`hiv_status` scos GDPR.)
- Pronouns (linie separată uppercase).
- `bio` (paragraf).
- `prompts` (Q&A, listă de carduri).
- `TagBlock "Looking for"`, `TagBlock "Interests"`.
- `PrivateAlbumViewer` (album privat gated).
- Banner "Right Now" (dacă `looking_now_until` viitor) + `looking_now_intent`.
- `TapFavoriteRow` (Tap emoji + Woof + Favorite).
- Sticky bottom bar: Pass / Message / Like.

**Aglomerare:** ~10 secțiuni. Scroll mediu (2–3 ecrane pe mobil). Restul câmpurilor de "lifestyle" (job, zodiac, workout, diet, drinking, smoking, education, religion, etc.) și "safer play" (`vaccinations`, `prep_status`, `safety_practices`), `expectations`, `scenes`, `meet_at`, `voice_prompt`, `anthem`, `video_clip`, `ideal_match`, `ask_me_about`, `dealbreakers` NU se randează aici — există în DB și în editor, dar drawer-ul discover le ignoră. → drawer-ul e deja destul de curat de-facto.

**A2. `src/routes/u.$slug.tsx` (356 linii)** — pagină publică share-abilă `/u/:slug` (nu e folosită din grilă; e pentru link extern).
- Hero foto (gallery) + nume + vârstă + Verified + `ProfileBadgesRow`.
- Auto-translate bio/ideal_match/prompts.
- Video clip, Voice prompt, Anthem (fiecare card).
- Ideal match (`"…"`).
- Ask me about (chip-uri).
- About (`bio`).
- Interests, Tribes.
- Stats grid: Height, Body, Job, Zodiac.
- CTA "Intră în Ventuza…".

**Aglomerare:** e o pagină "vitrină" mai bogată decât drawer-ul; folosită doar pentru share.

**Vizual dominant:** poza + nume/vârstă/distanță/online = deja "cel mai important". "Zgomotul" = suprapunerea `tribes` + `stats grid` + `pronouns` + `looking-for` + `interests` (multe chip-uri consecutive).

---

### B. PROFIL EDITAT (formularul tău)

**Ruta:** `src/routes/profile.tsx` (1194 linii). Combină **profil citit** (afișare) + `EditDrawer` (formular full-screen).

**Componente card-based în afișarea proprie:**
`PhotoManager`, `PhotoCoachButton`, `ProfileCompleteness`, `ProfileStatsRow`, `ShareProfileCard`, `VoicePromptCard`, `MusicAnthemCard`, `VideoClipCard`, `DateVibesCard` (ask_me_about / dealbreakers / ideal_match), `LifestyleFactsCard` (16 câmpuri), `RightNowCard`, `ProfilePremiumPanel`, `PrivateAlbumManager`, secțiuni Privacy (incognito + location sharing).

**`EditDrawer` (~300 linii) — secțiuni:**
- **About:** display_name (15c), bio (255c), interests ("My Tags").
- **Stats:** hide_age toggle, height_cm, weight_kg, ethnicity, body_type, position, relationship_status.
- **Preferences:** tribes, looking_for, meet_at, expectations, scenes, accept_nsfw_photos.
- **Identity:** gender, pronouns, orientation.
- **Health:** prep_status, safety_practices, vaccinations.

**Total câmpuri editabile inventariate (Profile type + carduri):** ~50 (excluzând poze/media/albume).
Câmpurile "lifestyle" (zodiac, languages, education, school, job_title, company, religion, politics, children, pets, drinking, smoking, cannabis, drugs, workout, diet, sleep_schedule) sunt DOAR în `LifestyleFactsCard` — nu în `EditDrawer`, se editează separat.

**Obligatorii (onboarding `/n`, `src/routes/n.tsx`, 6 pași):**
1. **basics**: `display_name` ≥ 2, `birthdate` cu vârstă ≥ 18. (Locked dacă e deja setat.)
2. **identity**: `gender` sau `gender_custom`, `pronouns` sau `pronouns_custom`, `orientation` ≥ 1.
3. **intent**: `looking_for` ≥ 1.
4. **stats**: TOATE opționale (skip permis).
5. **personality**: `interests` ≥ 3 (obligatoriu), prompts + bio opțional.
6. **photos**: cel puțin 1 poză + `terms_accepted`.

Restul (tribes, meet_at, expectations, scenes, safety, health, lifestyle 16, voice/anthem/video, ideal_match, ask_me_about, dealbreakers) sunt **opționale**, se completează după în `/profile`.

**Onboarding minimal-ok:** 6 pași, dintre care 2 pot fi trecuți repede (stats skip, personality doar interests). Realist ~2–3 min. Nu e extrem, dar identity+intent+personality forțează 5–7 selecții obligatorii.

---

### C. COMPARAȚIE GRINDR — ce ai în PLUS

**Grindr afișează pe profil altcuiva:** poză, nume, vârstă, "About", height/weight, body type, position, tribes, ethnicity, HIV status + last test, relationship status, online. Cam atât "above the fold" + expand.

**Câmpuri PE CARE LE AI ÎN PLUS FAȚĂ DE GRINDR** (candidați la "vezi mai mult" expandabil în ProfileDrawer discover):
| Zgomot potențial | Sursă |
|---|---|
| `prompts` (Q&A multiple) | drawer + `/u/:slug` — Hinge-style, poate rămâne dar sub fold |
| `MatchScoreBadge` sub titlu | drawer discover |
| `ask_me_about`, `dealbreakers`, `ideal_match` (`DateVibesCard`) | `/u/:slug`, nu în drawer |
| `voice_prompt`, `anthem`, `video_clip` | `/u/:slug`, nu în drawer — bogăție Hinge/Bumble |
| `expectations`, `scenes`, `meet_at` | scos din drawer, doar în `/profile` propriu |
| `zodiac`, `languages`, `education`, `job_title`, `religion`, `politics`, `children`, `pets`, `drinking`, `smoking`, `cannabis`, `drugs`, `workout`, `diet`, `sleep_schedule` (16 în `LifestyleFactsCard`) | doar în `/profile` propriu — NU se randează la altcineva |
| `vaccinations`, `safety_practices`, `prep_status` (Safer play) | doar `/profile` propriu; **HIV status intenționat scos GDPR** — un plus față de Grindr, nu un minus |
| `pronouns` afișat ca linie separată uppercase | drawer discover |
| `PrivateAlbumViewer` embed în drawer | drawer discover — util, dar mărește scroll |
| `TapFavoriteRow` embed inline | drawer discover — util, dar poate merge într-un action bar mai compact |

**IMPORTANT — de reținut:** `LifestyleFactsCard` (16 câmpuri) există ca editabil pe profilul propriu dar **NU este vizibil altcuiva** nici în drawer nici în `/u/:slug`. Există date "moarte" pe care userii le completează degeaba dacă nu adaugi randare la target.

**Ce e deja bine / minimal (nu atinge):**
- **Grila** (sprint anterior): poză + nume + vârstă + distanță + online + snake-border unread. E deja Grindr-clean.
- **Hero-ul drawer-ului**: poza mare + overlay compact (nume/vârstă/verified/online/distanță/înălțime). Deja aliniat cu Grindr.
- **Sticky action bar** Pass/Message/Like. Clar și minimal.
- **Onboarding basics** (nume + birthdate + identity + intent + photos). Rezonabil.

---

### RECOMANDĂRI DE SIMPLIFICARE (fără pierderi de funcționalitate)

**R1. Drawer discover (A1) — colapsează sub "Vezi mai mult":**
Above the fold să rămână: hero foto + nume/vârstă/online/distanță/înălțime + bio (2 linii clamped) + tribes + stats grid + `TapFavoriteRow` + sticky Pass/Message/Like.
Sub expand: prompts, looking_for, interests, pronouns, banner Right Now, `PrivateAlbumViewer`, `MatchScoreBadge` (mută-l lângă butonul Like, mai discret).

**R2. Randează în drawer câteva câmpuri "vii" care astăzi sunt orfane:**
Adaugă (opțional, sub expand): `voice_prompt`, `anthem`, `video_clip`, `ideal_match`, `ask_me_about`. Astăzi userii le pot edita dar nimeni nu le vede din grilă → risipă. Sau invers, dacă vrei minimalism strict: **elimină-le din editor** dacă rămân neafișate.

**R3. `/profile` propriu (B) — mută cardurile "grele" într-un tab/accordion:**
Actual: 12+ carduri consecutive (`PhotoManager`, `Completeness`, `Stats`, `Share`, `Voice`, `Music`, `Video`, `DateVibes`, `Lifestyle`, About/Prompts/Interests/Tribes/Stats/Expectations/MeetAt/Scenes/Safer/Identity/Activity/Verificare/Album/Privacy). Foarte lung.
Propune: 3 taburi — **"Esențial"** (foto, completeness, share, edit primary), **"Extra"** (voice, anthem, video, date vibes, lifestyle 16), **"Setări"** (privacy, verificare, premium, album, activity).

**R4. `EditDrawer` — reduce câmpurile obligatorii-in-your-face:**
Actual: 5 secțiuni (About/Stats/Preferences/Identity/Health). Toate deschise simultan. Preferences singură are 5 câmpuri de chip-uri (tribes, looking_for, meet_at, expectations, scenes).
Propune: colapsează Preferences → doar tribes + looking_for vizibile; meet_at/expectations/scenes sub "Detalii de întâlnire". Health rămâne colapsat by default (privacy-friendly).

**R5. Onboarding `/n` — de la 6 la 4 pași:**
Combină `identity` + `intent` într-un singur pas (utilizatorul oricum trebuie să le completeze consecutiv). Scoate `stats` din onboarding (toate opționale acolo → mută-le complet în `/profile`). Rezultat: basics → identity+intent → personality → photos = **4 pași, ~90 sec**.

**R6. `/u/:slug` (pagina share) — decide rolul:**
Astăzi e mai bogată decât drawer-ul. Fie o aliniezi cu drawer-ul (consistent), fie o păstrezi intenționat ca "landing bogat de share" (mai mult conținut = mai bun pentru SEO / conversie click extern). Nu o atinge fără decizie de produs.

---

### FIȘIERE CHEIE

- `src/routes/discover.tsx` — L1189–1378 = ProfileDrawer.
- `src/routes/u.$slug.tsx` — pagina publică share.
- `src/routes/profile.tsx` — profilul propriu (view + EditDrawer).
- `src/routes/n.tsx` — onboarding 6 pași.
- `src/components/QuickProfileDrawer.tsx` — meniul rapid din header (nu e "profil", e nav lateral).
- `src/components/ProfilePhotoGallery.tsx` — galerie foto (reused hero).
- `src/components/LifestyleFactsCard.tsx` — 16 câmpuri lifestyle (orfane la target).
- `src/components/DateVibesCard.tsx` — ask/dealbreakers/ideal_match.
- `src/components/VoicePromptCard.tsx`, `MusicAnthemCard.tsx`, `VideoClipCard.tsx` — media orfane la target din drawer.
- `src/components/ProfileBadgesRow.tsx`, `ProfileStatsRow.tsx`, `ProfileCompleteness.tsx`, `ProfilePremiumPanel.tsx`.

**Zero modificări aplicate.** Aștept decizia ta: R1+R5 dau cel mai mare câștig "curat, esențial, ca Grindr" cu efort mic.
