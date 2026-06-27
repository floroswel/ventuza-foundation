# Audit UX cap-coadă Ventuza — raport brutal

> Doar analiză, conform cererii. Mai jos rezumatul ambelor călătorii + fix-urile propuse pentru aprobare. Codul nu a fost atins.

---

## CĂLĂTORIA 1 — USER NOU (dating)

| Pas | Stare | Notă rapidă |
|---|---|---|
| 1. Landing `/` | ✅ | Există, age gate exclus corect pe `/`, `/auth`, `/n`. Zero semnal LGBTQ+ vizibil. |
| 2a. Signup email | 🔴 | Email confirmation limbo: rămâne pe `/auth`, fără resend, fără redirect, fără instrucțiuni. |
| 2b. OAuth | ⚠️ | Birthdate cerut pre-OAuth (corect legal) dar UX surprinzător; persist localStorage OK. |
| 3. Onboarding `/n` | 🔴 | Birthdate cerut a doua oară (nu citește profilul); state pierdut la refresh; moderare foto = blocant total la AI down. |
| 4. Consimțăminte | ⚠️ | Registry curat, dar dacă `ConsentPromptHost` nu e încă montat → `requestConsent` returnează silent `false`. |
| 5. Discover prima dată | ⚠️ | Empty state nu diferențiază "DB e goală/app e nou-lansat" de "n-ai vecini acum". |
| 6. Swipe → match → chat | ⚠️ | MatchModal + CTA OK. Dar "Message" disponibil fără match pe orice profil; `online` hardcodat; `window.confirm()` pentru unsend. |
| 7. Profil propriu | ⚠️ | Nicio previzualizare "cum mă văd alții"; pagină supraîncărcată cu carduri. |
| 8. Nearby/Events/Notifs/Settings | ⚠️ | Nearby gol perpetuu dacă geo refuzat; Squads gol fără hint; Settings → "Promovează businessul" duce la `/advertise` (greșit). |
| 9. Retenție primele minute | 🔴 | Zero prompt push în onboarding sau post-match. Retenția Day 2 cade brutal. |

### TOP probleme user (sortate pe gravitate)

1. **🔴 P0** — Email signup limbo, fără resend/redirect — `src/routes/auth.tsx:160-165`
2. **🔴 P0** — Moderare foto blocantă la AI down (poza ștearsă, min 1 obligatoriu) — `src/routes/n.tsx:549-554`
3. **🔴 P0** — Zero consent push în journey (nici onboarding, nici post-match) — niciun call site
4. **⚠️ P1** — Birthdate dublu (signup + step 1 onboarding) — `n.tsx:63` nu pre-populează din profil
5. **⚠️ P1** — State onboarding pierdut la refresh — `n.tsx:123-126` (pur `useState`)
6. **⚠️ P1** — Age gate biometric Didit fără ETA/timeout/notificare la finalizare — `AgeGate.tsx:134-138`
7. **⚠️ P2** — Message fără match → vector spam/safety — `discover.tsx:689-693`
8. **⚠️ P2** — `window.confirm()` pentru unsend, inconsistent cu propria regulă GDPR — `messages.$id.tsx:286`
9. **⚠️ P2** — Nearby/Squads ecrane moarte la geo refuzat sau DB goală — `nearby.tsx:72-74`, `groups.tsx`
10. **⚠️ P3** — "online" status fals în chat header (citește socket local, nu `last_seen`) — `messages.$id.tsx:356`

---

## CĂLĂTORIA 2 — BUSINESS NOU (partener)

| Pas | Stare | Notă rapidă |
|---|---|---|
| 1. Intrare | ⚠️ | Două intrări în Settings: una corectă (`/business`), una **greșită** la `/advertise`. Zero link `/partner` din nav. |
| 2. Înregistrare `/business` | ⚠️ | Submit OK, orphan-linking funcționează, dar `country` e text liber, nu select. |
| 3. După aplicare | 🔴 | `needs_info` spune "verifică emailul" — **dar emailul nu se trimite nicăieri** în cod. Polling/realtime OK pentru aprobare. |
| 4. Portal `/partner` + wizard | 🔴 | Wizard solid. **Cover URL semnat 30 zile** stocat în DB → toate pozele se sparg după o lună. |
| 5. Postare → moderare → status | 🔴 | Bell in-app cu polling 60s e singurul canal. Zero email/push la aprobare/respingere/`needs_info`. |
| 6. Facturare | ⚠️ | Plan-urile + OP OK. `BillingProfileCard` state bug (nu re-syncă pe `biz` async). Confirmarea plății manuale fără feedback vizibil. IBAN partener colectat dar neutilizat. |
| 7. Puncte moarte | 🔴 | `/partner` și `/business/dashboard` (ads) sunt **două portale paralele deconectate**. Landing trimite partenerul aprobat la `dashboard` (ads), nu la `/partner` (venues). |

### TOP probleme partener

1. **🔴 P0** — Cover URLs expiră în 30 zile → toate pozele venues/events broken — `src/routes/partner.tsx:594-607`
2. **🔴 P0** — Zero notificare proactivă la decizie moderare (nici email, nici push) — `src/lib/admin-partners.functions.ts:212`
3. **🔴 P1** — Două portale deconectate (`/partner` vs `/business/dashboard`); landing-ul aprobat trimite greșit — `src/routes/business.tsx:228-231`
4. **🔴 P1** — `needs_info` fără canal real de comunicare — `partner.tsx:194-196`
5. **⚠️ P1** — Settings → "Promovează businessul" → `/advertise` în loc de `/business` — `settings.tsx:402-403`
6. **⚠️ P2** — `BillingProfileCard` câmpuri goale la primul render (state derivat din props async) — `partner.billing.tsx:252-254`
7. **⚠️ P2** — Spinner etern pe `/partner` dacă fetch aplicație eșuează — `partner.tsx:173-179`
8. **⚠️ P2** — Confirmarea plății OP fără polling/notificare la activare — `partner.billing.tsx:213-245`
9. **⚠️ P3** — IBAN partener colectat, neutilizat, confuz vs IBAN Ventuza — `partner.billing.tsx:264`
10. **⚠️ P3** — `country` text liber 2-char în loc de select țări — `business.tsx:418`

---

## Plan de remediere propus (Val 5)

Execut TOATE fix-urile P0 + P1 într-un singur sprint, fără confirmare între item-uri (conform preferinței `mem://~user`). Ordine de execuție:

### Bloc A — Safety & data loss (P0 partener + user)
1. **Cover URLs permanente.** Schimb `uploadCover` să stocheze `path` în DB (`venues.cover_path`, `events.cover_path`) și să genereze signed URL la citire (1h, refresh on-demand) — sau migrez bucket-ul `venue-media` la public (decizie: aleg signed-on-read, păstrăm controlul). Backfill: re-generez signed URLs pentru rândurile existente la prima citire.
2. **Notificare proactivă moderare.** În `admin_moderate_item` (SQL) inserez în `notifications` (canal in-app deja existent) ȘI declanșez push prin `web-push.server.ts` dacă partenerul are `push_subscriptions`. Adaug coadă email best-effort (folosesc connector existent dacă există; altfel logăm `TODO` și marcăm `needs_email_provider` în Art. 30 register). Zero canal nou de comunicare neînregistrat.
3. **Moderare foto cu fallback "pending review".** În `n.tsx PhotosStep` + `PhotoManager`: dacă `moderatePhoto` throw (nu `!allowed`), accept poza cu `moderation_state='pending'` și o marchez invizibilă altora până la review. Userul finalizează onboarding-ul.

### Bloc B — Conversie & navigație (P0/P1)
4. **Email signup limbo fix.** După signup fără sesiune: redirect la `/auth/check-email?email=...` cu buton resend (apel `supabase.auth.resend({ type: 'signup' })`) + countdown 60s.
5. **Push consent în journey.** Adaug prompt `requestConsent("push_notifications")` la primul match (în `MatchModal` onClose) și un secondary prompt la finalul onboarding-ului (step 6, după Finish, înainte de redirect la `/discover`).
6. **Onboarding: pre-populate + persistență.** `/n` citește profilul la mount și pre-completează `birthdate`, `display_name` dacă există. State salvat în `localStorage` la fiecare `setData`, golit la Finish.
7. **Unificare portale partener.** Adaug în `/partner` un tab/link permanent către `/business/dashboard` (Ads) și viceversa. Landing `/business` pentru `status=approved` → schimb butonul primar la `/partner`, secundar la `/business/dashboard`. Mount `StatusNotificationsBell` în `/business/dashboard` și în header global pentru parteneri.
8. **Settings link corect.** "Promovează-ți businessul" → schimb destinația la `/business` (aplicare) pentru non-parteneri și la `/partner` pentru parteneri aprobați. Păstrez separat un link "Campanii publicitare" → `/advertise`.
9. **`/partner` error state.** Înlocuiesc `pendingChecked` boolean cu trio `loading/error/data` (regula AGENTS.md ADMIN PANELS aplicată și aici); banner cu retry.

### Bloc C — Polish (P2)
10. `BillingProfileCard` state derivat → `useEffect` sync pe `biz` sau `key={biz?.id}` pentru remount.
11. Invoice status polling la `/partner/billing` (15s) + toast la trecerea `pending_payment` → `paid`.
12. `window.confirm()` pentru unsend → `ConsentPromptHost`/`AlertDialog`.
13. Empty state Discover/Nearby/Squads: copy contextual ("Suntem în lansare în orașul tău" + buton "Anunță-mă când apare cineva" — opt-in push).
14. Country select în `/business`.

### Bloc D — Amânat conștient
- Email transactional dedicat (resend, moderation decision, invoice paid): necesită provider configurat. Implementez infrastructura `mail.server.ts` care logează + apelează provider dacă variabila e setată; altfel no-op cu warning. Documentez în Art. 30 ca "DPA pending — provider TBD".
- "Online" status real (citește `last_seen` la abonare + update presence): refactor mai mare, intră în Val 6.
- Previzualizare profil "cum mă văd alții": adaug doar buton "Vezi profilul public" linkat la `/u/$slug` existent.

### Reguli respectate
- Health/locație/Art.9: zero atingere.
- Moderation gate `admin_moderate_item` rămâne sursa unică; doar adaug notificare în aceeași tranzacție.
- Niciun procesator nou fără actualizare `legal.subprocessors.tsx` + Art. 30 (email provider blocat pe acest criteriu).
- Push consent gated prin `consent_registry` existent.

### Estimare scop
~14 fișiere atinse, 1 migrare SQL (notificări moderare + `cover_path` în loc de `cover_url`), 0 dependențe noi. Verific cu typecheck la final.

Confirmă "ok" și execut Blocurile A→D în ordine, fără pauze intermediare.
