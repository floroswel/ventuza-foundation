# Audit UX cap-coadă — Ventuza (doar analiză, fără modificări de cod)

Două călătorii trasate pas cu pas pe codul real, pe baza a două sub-agent-uri care au citit rutele, server fns, triggerele DB și componentele. Notație: ✅ curge · ⚠️ confuz/incomplet · 🔴 rupt / ecran gol / buton mort.

---

## CĂLĂTORIA 1 — USER NOU DE DATING

### Pasul 1 — Aterizare pe aplicație (`src/routes/index.tsx`)
- **Ce vede:** Wordmark „Ventuza", tagline „Dating, elevated.", două butoane mari **Create account** / **Log in**, plus link-uri 11px „Pentru parteneri" și „Siguranță".
- **Spate:** dacă e deja autentificat → query `profiles.onboarding_completed` → redirect la `/n` sau `/discover`.
- ⚠️ **AgeGate flash** (`AgeGate.tsx:28`): `enforce` start `false`, async citește policy ~50ms. În prod, gate-ul nu se vede instant — risc FOUC pe rute gated.

### Pasul 2 — Signup / Login (`auth.tsx`)
- **Câmpuri:** email + parolă + dată naștere + checkbox „18+" + checkbox Terms. Tab Login/Signup, butoane Google + Apple.
- ✅ Validări Zod pe email/parolă, signup blocat dacă lipsesc date.
- 🔴 **OAuth bypass vârstă** (`auth.tsx:152-176`): `onOAuth("google")` verifică doar `over18 && acceptTerms`, **NU `birthDate`**. Userul OAuth poate intra fără să introducă data, `profiles.birthdate` rămâne `null`, triggerul DB `enforce_min_age` nu acționează pe `null`. `SessionGuards` îl redirectează la `/n` — dar nu există dată reală până când userul deschide app-ul a doua oară.
- 🔴 **Login redirect spre Cruise** (`auth.tsx:45`): `routeAfterAuth` trimite useri cu onboarding complet la `/cruise` (feed „Right Now / hook-up acum"), nu la `/discover`. Userul care nu a activat „Caut acum" aterizează pe un feed gol. Bounce garantat la second visit.

### Pasul 3 — Onboarding `/n` — 6 pași
- **Pași:** Basics → Identity → Intent → Stats → Personality → Photos. Sărirea nu este permisă: `canContinue` blochează butonul pe fiecare pas.
- ✅ Enforcement: nume ≥2 chars + birthdate + vârstă ≥18; gen + pronume + orientare; min 1 looking_for; consent obligatoriu dacă HIV completat; min 3 interese; min 1 foto + Terms.
- ⚠️ **Birthdate `max=today`** (`n.tsx:293`): userul poate selecta orice zi din trecut, inclusiv ieri. Eroarea apare DUPĂ selecție, nu prin atribut `max = today - 18y`.
- ⚠️ **Inconsistență limită poze** (`n.tsx:520` vs `:558`): cod permite 9, UI ascunde slot upload după 6. Confuzie + posibilă truncare silențioasă în PhotoManager (limit 6) la revenire pe profil.
- ✅ La finish → `navigate("/profile")` (vede ce a creat). Necomunicat ca pas, dar acceptabil.

### Pasul 4 — Consimțăminte
- ✅ `ConsentPromptHost` montat în `__root.tsx:199` — dialog Art. 7 real (nu `window.confirm`).
- ✅ `CookieBanner` prezent. `terms` + `privacy` în `consent_log` la final onboarding. `health_data` doar dacă HIV completat.
- 🔴 **AgeGate GATED_PREFIXES incomplete** (`AgeGate.tsx:13`): `/cruise`, `/nearby`, `/visitors`, `/favorites` NU sunt în listă. User cu `age_status=unverified` poate accesa direct Cruise (conținut „right now") fără verificare. Problemă legală (dating, minori).

### Pasul 5 — Discover first paint (`discover.tsx`)
- ✅ EmptyState: când `visible.length === 0` → mesaj „No one new nearby right now." + buton Refresh.
- ✅ Locație denied → toast informativ + filtrare alternativă, fără blocare.
- ✅ Toate butoanele din header duc undeva real: NotificationBell → `/notifications`, link `/cruise` există, incognito toggle funcțional.
- 🔴 **Tab „Online" cod mort** (`discover.tsx:39, 275-276`): tipul `Tab = "nearby" | "online" | "fresh"`, state-ul și logica `isOnline()` există, dar **niciun `<TabBtn>` randat**. Stare validă în TS, inaccesibilă din UI.

### Pasul 6 — Swipe → Match → CTA → Chat
- ✅ Trigger DB `handle_swipe` creează `matches` idempotent la like reciproc (verificat la sprintul anterior).
- ✅ `MatchModal` are CTA „Trimite primul mesaj" → `getOrCreateConversation(match.id)` → `/messages/$id`. Lanț end-to-end funcțional.
- ⚠️ **Open messaging fără match** (`discover.tsx:677-681`): butonul „Message" din ProfileSheet apelează direct `getOrCreateConversation`, fără verificare match. Oricine deschide chat cu oricine. Poate fi by design, dar nu e comunicat.
- ✅ `/messages/$id`: real-time, typing, reactions, unsend 5 min, empty state „Say something nice to {name}.".

### Pasul 7 — Profil propriu (`profile.tsx`)
- ✅ PhotoManager: max 6, AI moderation, drag reorder, persistă imediat la fiecare schimbare.
- ✅ Redirect la `/n` dacă onboarding incomplet.
- ⚠️ **EditPanel fără validare required**: `display_name` poate fi golit și salvat. Onboarding forța ≥2 chars, edit-ul nu mai verifică.

### Pasul 8 — Nearby / Events / Notifications / Settings / Cruise / Visitors
- ✅ Toate rutele există, EmptyState corect, BottomNav prezent peste tot.
- ⚠️ **`/nearby` fără auth guard explicit**: user neautentificat vede eroare generică din `errorComponent`, nu redirect la `/auth`.

### Pasul 9 — Retenție primele minute
- ✅ DailyRewardCard (poll 60s, toast la claim), GoldenHourBadge în header Discover, `/quests` accesibil din BottomNav, push opt-in nu forțat.
- ⚠️ Lipsesc trigger-e proactive in-app (toast „Ai un quest nou", onboarding tour scurt) — userul descoperă singur funcțiile.

---

## CĂLĂTORIA 2 — BUSINESS NOU (partener)

### Pasul 1 — Intrarea în aplicație
- 🔴 **Intrare practic invizibilă**: singurul link din homepage e `"Pentru parteneri →"` la `text-[11px]` în footer (`index.tsx:92`). Niciun CTA, hero, banner. BottomNav: zero. Header logged-in: zero. Doar `/settings` → secțiunea „Pentru businessuri" (`settings.tsx:449`), dar trebuie să fii deja user logat.

### Pasul 2 — Formular `/business`
- ✅ Landing bine construit: pachete preț, FAQ, listă necesar, ANAF auto-complete, secțiune conformitate (DPA, charter LGBTQ+).
- ✅ Formular: secțiuni clare (Despre / Contact / Obiectiv / Conformitate), validare Zod română, toast la primul câmp invalid.
- 🔴 **BUG CRITIC `user_id = null` mereu** (`business-apply.functions.ts:63`): chiar dacă userul e autentificat când aplică, cererea se salvează cu `user_id=null`. Depinde de `linkOrphanBusinessApps` care leagă post-hoc prin email — fragil. Consecințe în cascadă pe `/partner/billing` (vezi Pasul 6).
- 🔴 **DoneScreen dead end** (`business.tsx:490`): după submit doar buton „Înapoi acasă" → `/`. Niciun link spre `/partner` sau status page. Partenerul e trimis acasă fără ce să facă.

### Pasul 3 — Așteptare aprobare
- ⚠️ Banner status în `/business` din **localStorage** — schimbă browserul, dispare.
- 🔴 **Partener pending la `/partner`** (`partner.tsx:135-148`): vede mesaj identic cu non-partener: „Aplică pentru cont partener". Zero diferențiere „cererea ta e în analiză".
- 🔴 **Aprobare fără notificare in-app**: `partner_status_notifications` notifică doar decizii de moderare pe items, NU aprobarea aplicației B2B. Partenerul află doar prin email (manual). Spam → niciodată.

### Pasul 4 — Portal `/partner`
- **Rute reale:** `/partner`, `/partner/billing`, `/partner/guide`. Venues/events/offers = **tab-uri** în `/partner`, nu rute separate.
- ✅ StatusTiles (Live / Moderare / Atenție), QuotaPanel, StatusBadge per item, motiv staff afișat la rejected.
- ⚠️ **`partner.tsx` fără `<Outlet />`**: `/partner/billing` și `/partner/guide` se randează independent. `StatusNotificationsBell` nu apare pe ele — pe billing/guide partenerul nu vede notificări de moderare.
- ✅ **Suspended state**: banner roșu explicit, butoane disabled.
- ⚠️ Banner suspended fără email/buton de contact concret.

### Pasul 5 — PostingWizard (5 pași) + moderare
- ✅ Tip / Detalii (template-driven) / Locație+rază / Preview Nearby + Preview notificare / Confirmare. Hints + „Vezi exemplu" pre-completat. Upload imagine direct, erori quota prinse explicit (`quota_exceeded`, `rate_limited`, `suspended`).
- ⚠️ **Ofertă pe venue nepublicat** (`PostingWizard.tsx:135`): wizard blochează doar dacă `myVenues.length === 0`, nu filtrează după `status='approved'`. Partenerul poate atașa ofertă la venue pending/rejected.
- 🔴 **Signed URL 30 zile expiră silențios** (`partner.tsx:496`, `PostingWizard.tsx:566`): imaginile cover dispar din portal și Nearby după o lună, fără reînnoire automată, fără avertisment, fără eroare vizibilă.
- ✅ StatusNotificationsBell în header `/partner`, polling 60s, badge necitite, mark-as-read.
- ⚠️ Bell absent pe `/partner/billing` și `/partner/guide` (layout nesting absent).
- ⚠️ Zero push real — doar polling. Browser închis → nu află imediat.
- 🔴 **Edit fără confirmare retrimitere**: după editarea unui item respins, badge revine la „În așteptare" dar fără toast „Retrimis la moderare". Partenerul poate crede că e draft local.

### Pasul 6 — `/partner/billing`
- ✅ Plan + entitlements + tabel facturi + **modal instrucțiuni OP excelent** (CUI, IBAN, sumă, cod plată unic copiabil).
- 🔴 **`BillingProfileCard` gol dacă `user_id=null`** (`partner.billing.tsx:62-65`): query `.eq("user_id", user.id).eq("status","approved")` întoarce `null`, partenerul vede `"—"` la propriul CUI/legal_name. Upgrade blocat fără cale clară.
- ⚠️ **Inconsistență valutară**: landing arată €149/€499, billing afișează în RON.
- ⚠️ Câmp „IBAN (opțional)" fără explicație → poate fi confundat cu IBAN-ul Ventuza.
- ⚠️ Dacă admin nu a configurat `issuer.iban`: „Emitentul nu este complet configurat. Contactează administratorul." — fără email de contact.

### Pasul 7 — Confuzia majoră finală
- 🔴 **Două portale distincte fără legătură**: `/business/dashboard` (campanii ads) vs `/partner` (venue/event/offer). Niciun link între ele. Partenerul aprobat urmează link-ul din landing → ajunge la campanii publicitare, nu la portalul unde postează locuri.

---

## ECRANE GOALE / BUTOANE MOARTE — listă tehnică

| # | Problema | Fișier:linie | Tag |
|---|---|---|---|
| 1 | OAuth signup nu persistă `birthdate` | `auth.tsx:152-176` | 🔴 |
| 2 | Login redirect spre `/cruise` în loc de `/discover` | `auth.tsx:45` | 🔴 |
| 3 | AgeGate exclude `/cruise`, `/nearby`, `/visitors`, `/favorites` | `AgeGate.tsx:13` | 🔴 |
| 4 | Tab „Online" definit dar nerandat | `discover.tsx:39,275-276` | ⚠️ |
| 5 | Onboarding photos: cod permite 9, UI ascunde la 6 | `n.tsx:520,558` | ⚠️ |
| 6 | Birthdate `max=today` în loc de `today - 18y` | `n.tsx:293` | ⚠️ |
| 7 | Open messaging fără match (ProfileSheet) | `discover.tsx:677-681` | ⚠️ |
| 8 | EditPanel profil: `display_name` poate fi golit | `profile.tsx` EditPanel | ⚠️ |
| 9 | AgeGate flash ~50ms (`enforce` start false) | `AgeGate.tsx:28` | ⚠️ |
| 10 | Submit business salvează `user_id=null` mereu | `business-apply.functions.ts:63` | 🔴 |
| 11 | DoneScreen partener doar „Înapoi acasă" | `business.tsx:490` | 🔴 |
| 12 | Partener pending = mesaj identic cu non-partener | `partner.tsx:135-148` | 🔴 |
| 13 | Aprobare aplicație fără notificare in-app | trigger DB parțial | 🔴 |
| 14 | Signed URL 30 zile → imagini dispar silențios | `partner.tsx:496` | 🔴 |
| 15 | Billing gol dacă `user_id=null` | `partner.billing.tsx:62-65` | 🔴 |
| 16 | `/business/dashboard` ≠ `/partner` fără legătură vizibilă | — | 🔴 |
| 17 | Bell notificări absent pe `/partner/billing`+`/guide` | layout nesting | ⚠️ |
| 18 | Edit item respins fără toast „retrimis la moderare" | `partner.tsx:280-315` | ⚠️ |
| 19 | Ofertă pe venue nepublicat permisă în wizard | `PostingWizard.tsx:135` | ⚠️ |
| 20 | Inconsistență valutară EUR landing vs RON billing | `business.tsx` / `partner.billing.tsx` | ⚠️ |
| 21 | Banner suspended fără email contact | `partner.tsx:174-181` | ⚠️ |
| 22 | `/nearby` fără auth guard → eroare generică | `nearby.tsx` | ⚠️ |
| 23 | Intrare partener invizibilă (11px footer) | `index.tsx:92` | 🔴 |

---

## TOP FRUSTRĂRI — ordonate după gravitate

### DATING
1. 🔴 **Login te aruncă pe Cruise gol** (`auth.tsx:45`). Cel mai mare bounce trigger zilnic — orice user revenit aterizează pe feed „Right Now" gol dacă nu a activat modul.
2. 🔴 **OAuth bypass vârstă** (`auth.tsx:152`). Risc legal direct (dating, minori). Trigger DB nu poate verifica `null`.
3. 🔴 **Cruise/Nearby/Visitors/Favorites accesibile fără AgeGate** (`AgeGate.tsx:13`). Risc legal — conținut adult accesibil pre-verificare.
4. ⚠️ **Tab Online definit dar invizibil** (`discover.tsx`). Cod mort.
5. ⚠️ **Limita poze inconsistentă 6 vs 9** (`n.tsx`). Truncare silențioasă la PhotoManager.

### PARTENER B2B
1. 🔴 **`user_id=null` rupe billing și status** (`business-apply.functions.ts:63`). Date fiscale invizibile, upgrade blocat. Trebuie suport manual.
2. 🔴 **Aprobarea aplicației doar prin email manual** — fără notificare in-app, fără status real în `/partner` pentru pending. Spam → niciodată.
3. 🔴 **Două portale paralele fără legătură** (`/business/dashboard` vs `/partner`). Partenerul aprobat ajunge pe portal greșit.
4. 🔴 **DoneScreen dead end** + intrare 11px în homepage. Partenerul e trimis acasă fără cale înainte.
5. 🔴 **Signed URL 30 zile expiră silențios** — imagini cover dispar din Nearby după o lună.

---

## Verdict scurt

**Dating:** scheletul funcționează (match → CTA → chat e solid acum). Problemele critice sunt concentrate în **auth/redirect/gating**: OAuth fără birthdate, login pe Cruise gol, AgeGate parțial. Fix-uri mici, impact mare.

**Partener:** scheletul tehnic e bun (PostingWizard, notificări moderare, billing OP). Problemele critice sunt în **conectarea fluxurilor**: intrare invizibilă, `user_id=null`, lipsă notificare aprobare, două portale dezlegate. Un partener legitim poate rămâne blocat la oricare din aceste 5 puncte fără cale înainte.

Aștept aprobare pentru a transforma această analiză într-un sprint de fix-uri P0 (sau pentru a prioritiza un subset).