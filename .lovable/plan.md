
# Portal Partener — raport + plan unificat

## PARTEA 1 — Verificare lanț cap-coadă (existent)

| # | Verigă | Status | Notă |
|---|---|---|---|
| 1 | Partener creează venue/event/offer (draft) | ✅ | `partner.functions.ts` → insert cu `moderation_status='pending'`, `is_published=false`. Quota verificată server-side (`checkQuota`). |
| 2 | Trigger DB blochează auto-publicarea | ✅ | `*_no_self_publish` pe venues/events/offers + RLS owner-only. Partenerul NU poate seta `is_published`/`is_official` (curățat la insert). |
| 3 | Staff aprobă în admin | ✅ | `adminModerateItem` → RPC `admin_moderate_item` (SECURITY DEFINER, `is_staff` gate), setează `is_published=true`, scrie `admin_audit_log`. |
| 4 | Apare în Nearby (listă + hartă) | ✅ | `nearby_points` RPC + filtru `is_published AND moderation_status='approved' AND partner_suspended_at IS NULL`. Hartă MapLibre + bucket distanță. |
| 5 | Notificare proximitate cu plafon/cooldown/quiet | ✅ | `try_record_proximity_hit` validează `app_settings.proximity_notifications` (cooldown, daily cap, quiet hours, rază max). Niciun bypass UI. |
| 6 | Partener vede status + stats (fără identități) | ✅ parțial | `partnerListMyItems` arată status + `rejection_reason`. `partnerGetOfferStats` întoarce doar `{total, redeemed}`. **LIPSEȘTE**: notificare ACTIVĂ la schimbare de status — userul trebuie să intre singur în portal. |

### Verigi rupte / lipsă (toate non-blocante pentru lanțul tehnic, dar incomplete UX)

- **R1 — Fără notificare push/in-app la decizia moderării**. `admin_moderate_item` actualizează rândul + scrie audit log, dar partenerul nu primește un eveniment dedicat ("Aprobat ✓" / "Respins: motiv X"). Trebuie să verifice manual portalul.
- **R2 — Fără preview înainte de submit**. Formularul curent salvează direct; partenerul nu vede cum va arăta cardul în Nearby/notificare.
- **R3 — Fără template-uri/exemple**. Câmpurile sunt goale, fără placeholder-uri instructive, fără lungimi minime sugerate, fără structură ghidată ("ce / când / pentru cine / de ce să vii").
- **R4 — Fără pagină reguli**. Partenerul nu vede din start ce e permis / interzis / SLA moderare / cum funcționează notificările anti-spam.
- **R5 — Wizard absent**. Crearea pornește direct de pe dialog tehnic; nu există flux pas-cu-pas care să educe.

**Concluzie: lanțul tehnic funcționează cap-coadă, fără rupturi de date. Lipsa este pur UX: ghidare + feedback la decizie. Restul reparațiilor sunt aditive, nu modifică contractele existente.**

## PARTEA 2-5 — Plan implementare

### A. Notificare status partener (R1)
- Migrare SQL:
  - Tabel `partner_status_notifications` (id, partner_id, kind, item_id, item_title, decision, reason, created_at, read_at). RLS: owner-only SELECT; INSERT doar via SECURITY DEFINER.
  - Modific `admin_moderate_item` să insereze o linie aici după update (în aceeași tranzacție). Owner-ul se ia din venues.owner_id / events.host_id / venues.owner_id via offer.venue_id.
- Server fn `partnerListStatusNotifications` + `partnerMarkNotificationRead`.
- UI: badge cu count nemodificat în header portal + dropdown care listează ultimele 20 decizii (Aprobat/Respins/Cere modificări + motiv). Marcare ca citit la click. Toast pe deschiderea portalului dacă există necitite.
- (Push real opțional — același tabel poate alimenta și push prin worker existent dacă userul are subscription. Faza 1: doar in-app.)

### B. Wizard ghidat de postare (Partea 2)
- Componentă nouă `src/components/partner/PostingWizard.tsx` cu state machine 5 pași:
  1. **Tip** — 3 carduri mari (Local / Eveniment / Ofertă) cu explicație + când să folosești fiecare. Verifică quota; dacă e atinsă, blochează cardul și sugerează upgrade plan.
  2. **Detalii** — formular generat din template (Partea C), cu placeholder real + hint sub fiecare câmp + counter caractere + indicator "obligatoriu".
  3. **Locație** — `PinMap` existent + slider rază notificare (100m–10km, cu default din `app_settings.proximity_notifications.default_radius_m`). Text live: "Userii la sub Xkm vor fi anunțați (respectând limitele lor anti-spam)."
  4. **Preview** — randare exactă cum apare în Nearby (`NearbyCardPreview`) + cum apare push-ul ("📍 [Nume] • 450m").
  5. **Trimitere** — buton "Trimite la moderare" + mesaj final cu SLA 1-2 zile + că va primi notificare în portal.
- Înlocuiește butoanele "Loc nou / Eveniment nou / Ofertă nouă" cu un singur CTA "+ Postare nouă" care deschide wizard-ul. Dialogurile vechi rămân disponibile pentru editare (rapid, fără wizard).
- Validări client + server (server e cel din `partner.functions.ts` — neatins).

### C. Template-uri (Partea 3)
- Fișier `src/lib/partner-templates.ts` cu `VENUE_TEMPLATE`, `EVENT_TEMPLATE`, `OFFER_TEMPLATE`: fiecare cu lista de câmpuri + label + hint + placeholder + min/max + required + opțional `example_value`.
- Buton "Vezi exemplu real" în pas 2 al wizardului care pre-completează cu un exemplu complet pe care partenerul îl poate edita.
- Validare zod în client identică cu cea din server (single source: schema declarată în `partner-templates.ts`, reexportată în `partner.functions.ts`).

### D. Ghid pentru parteneri (Partea 4)
- Rută nouă `/partner/guide` (`src/routes/partner.guide.tsx`). Conținut secțiuni:
  - Ce poți posta (Local / Eveniment / Ofertă) — exemple bune și rele.
  - **Interzis**: escort, conținut sexual explicit, înșelătorie, spam, discriminare, outing involuntar, conținut fără drepturi. Link la termeni.
  - Formate imagini: jpg/png/webp, max 5 MB, recomandat 1200×800, peisaj.
  - De ce trecem prin moderare + SLA 1-2 zile lucrătoare.
  - Cum funcționează notificările de proximitate: cooldown 24h/punct, plafon zilnic per user, ore liniștite — partenerul NU controlează aceste limite.
  - Cum funcționează respingerea: vezi motivul în portal, corectezi, retrimiti.
- Link mare "Citește ghidul" pe pagina principală portal + sub fiecare câmp cu "tip" mic.

### E. Mesaje respingere clare (Partea 4 final)
- Deja există `rejection_reason` în UI. Adăugare:
  - Card dedicat sus în portal: "X postări necesită atenție" cu listă click-to-edit pentru `rejected` / `changes_requested`.
  - Pre-completare wizard în modul "edit + remoderate" cu motivul vizibil sus + checklist sugerat ("Lipsește descriere ≥50 caractere", etc.) când motivul match-uiește pattern-uri cunoscute.

### F. Dashboard status (Partea 5)
- Sus în portal, înlocuim cards inline cu 3 tile-uri:
  - **Live** (count aprobat + publicat).
  - **În moderare** (pending).
  - **Necesită atenție** (rejected + changes_requested), highlight roșu dacă > 0.
- Click pe tile filtrează lista.

### G. AGENTS.md — reguli noi
Adăugare secțiune **REGULĂ — WIZARD PARTENER (permanentă)**:
- Toată crearea de venue/event/offer din UI partener trece prin `PostingWizard` (sau prin server fn-urile existente programatic). Nu se introduc forme noi de creare directe care ocolesc preview-ul.
- Template-urile sunt sursa unică pentru schema câmpurilor în UI partener (`partner-templates.ts`) — sincronizate cu validatorii zod din `partner.functions.ts`.
- Notificările de status partener trec EXCLUSIV prin `partner_status_notifications` populat de `admin_moderate_item`. Nicio cale paralelă (nici emailuri ad-hoc, nici push direct din UI admin).

## Note tehnice

- Niciun contract server existent nu se modifică (`partner.functions.ts`, `nearby_points`, `try_record_proximity_hit`, RLS, triggere). Wizard-ul e pur UX peste API curent.
- Singura modificare DB: tabel nou `partner_status_notifications` + extindere `admin_moderate_item` cu un INSERT idempotent. Audit log, moderare obligatorie, quota, anti-spam = NEATINSE.
- Respect AGENTS.md: moderare obligatorie ✓, quota server-side ✓, fără identități în stats ✓, fără owner self-publish ✓, plafoane user neatinse ✓.

## Confirmare cerută

Confirmi planul? Implementez în această ordine: (A) notificări status → (D+E) ghid + mesaje respingere → (C) template-uri → (B) wizard → (F) dashboard → (G) AGENTS.md.
