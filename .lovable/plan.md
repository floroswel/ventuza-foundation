
# Sistem facturare parteneri prin transfer bancar (OP)

Construit DEASUPRA: `business_applications` (date fiscale + ANAF), `app_settings` (versionat),
`admin_audit_log`, `partner.functions.ts` (assertPartner/assertQuota), Art. 30 register.
ZERO procesatori de plată externi. Banca NU este procesator de date personale user.

## Sprint 1 — Schemă DB (o singură migrare)

### Tabele noi

**`partner_plans`** — catalog planuri (Free/Pro/Premium), seed inițial.
- `code` (Free|Pro|Premium, PK), `name`, `price_minor` (cenți RON), `vat_rate` (19),
  `currency` (RON), `entitlements` JSONB:
  `{ max_venues, max_events, max_offers, push_priority (none|medium|high),
     featured_in_nearby, badge_verified, can_create_boost, max_notifications_per_day }`
- `active boolean`, `sort_order`

**`partner_subscriptions`** — abonament activ per partener (owner_id = profiles.id).
- `owner_id` UNIQUE, `plan_code`, `status` (active|grace|free_downgraded|cancelled),
  `current_period_start`, `current_period_end`, `grace_until`, `last_invoice_id`,
  `auto_invoice boolean` (recurență on/off).
- Default pentru orice partener aprobat: row cu `plan_code='Free'`, fără perioadă.

**`partner_invoices`** — factură proformă/fiscală.
- `id`, `owner_id`, `series` (ex: 'VTZ'), `number` int, `year`, UNIQUE(series, number, year)
- `payment_code` text UNIQUE (ex: `VTZ-2026-0001`) = mențiune OP
- `plan_code`, `period_start`, `period_end` (sau NULL pentru boost one-off)
- `kind` (subscription|boost)
- `subtotal_minor`, `vat_minor`, `total_minor`, `currency`
- `status` (draft|pending_payment|paid|overdue|cancelled|refunded)
- `issued_at`, `due_at` (issued + 7 zile), `paid_at`, `paid_amount_minor`, `paid_ref` (referință extras OP)
- Snapshot date fiscale partener la momentul emiterii (JSONB `billing_snapshot`)
- `confirmed_by` (uuid admin), `notes`
- `pdf_url` (generat on-demand, nu stocat default)

**`partner_invoice_counters`** — contor secvențial **fără goluri** per `(series, year)`.
- PK (series, year), `next_number int` cu lock + funcție SECURITY DEFINER `next_invoice_number(series, year)`.

**`partner_boost_orders`** — boost one-off per event (top Nearby 48h).
- `id`, `owner_id`, `event_id`, `invoice_id`, `starts_at`, `ends_at`, `active boolean`.
- Activat numai la `paid` confirm.

### Extensii pe `business_applications`
- `+ iban text` (opțional), `+ billing_email text`, `+ is_vat_payer boolean default false`,
  `+ billing_completed_at timestamptz`.

### `app_settings` (versionat) — nou kind
- `billing_settings`:
  ```json
  {
    "issuer": { "name": "...", "cui": "...", "reg_com": "...", "address": "...",
                "iban": "RO00 ...", "bank": "...", "email": "billing@..." },
    "invoice_series": "VTZ",
    "vat_rate": 19,
    "currency": "RON",
    "grace_days": 7,
    "reminder_days": [3, 7, 10],
    "recurring_lead_days": 7,
    "prices": {
      "Pro":    { "monthly_minor": 24500 },
      "Premium":{ "monthly_minor": 74500 },
      "Boost":  { "min_minor": 4500, "max_minor": 14500 }
    }
  }
  ```
- Singura sursă de adevăr pentru preț + TVA. Modificare DOAR prin `admin_update_setting` (deja existent).

### RPC-uri / triggere

- `next_invoice_number(series, year)` — atomic, ridică `next_number`, fără goluri.
- `partner_create_invoice(owner_id, plan_code, kind, period_start, period_end, boost_event_id)` — SECURITY DEFINER, calculează sumă din `billing_settings.prices` + TVA, snapshot date fiscale din `business_applications`, alocă `payment_code`.
- `admin_confirm_invoice_payment(invoice_id, amount_minor, paid_ref, paid_at)` — gated `is_staff`:
  - marcează `paid`, scrie `confirmed_by`, scrie audit `partner_invoice_confirm_payment`.
  - dacă `kind=subscription` → activează/extinde `partner_subscriptions` (period_end += 1 lună, `status='active'`).
  - dacă `kind=boost` → activează `partner_boost_orders` (starts_at=now, ends_at=now+48h).
- `admin_cancel_invoice(invoice_id, reason)` — gated, audit.
- `partner_active_entitlements(owner_id) RETURNS jsonb` — întoarce entitlements efective (Free dacă fără sub activ).
- Trigger `partner_subscriptions_downgrade_on_expire` (verificat de cron, nu trigger).

### RLS (toate noile tabele)
- `partner_plans` SELECT public (catalog).
- `partner_subscriptions` / `partner_invoices` / `partner_boost_orders`: owner SELECT, staff SELECT, scriere DOAR prin RPC SECURITY DEFINER.
- GRANT corect pe fiecare (authenticated + service_role).

## Sprint 2 — Server fns + cron

`src/lib/billing.functions.ts`:
- `partnerListMyInvoices()` / `partnerListMyPlans()` / `partnerGetActivePlan()`
- `partnerStartSubscription({ plan_code })` → creează factură proformă, întoarce payment_code + IBAN + sumă.
- `partnerOrderBoost({ event_id, price_minor })` → factură boost.
- `partnerGetInvoicePdf(invoice_id)` → HTML→PDF on-demand server-side (jsPDF/react-pdf inline, fără dependențe nesigure).
- `assertEntitlement(owner_id, key)` helper exportat — folosit de `partner.functions.ts` (înlocuiește `assertQuota` cu wrapper care citește `partner_active_entitlements`).

`src/lib/billing-admin.functions.ts` (gated `is_staff`):
- `adminListInvoices({ status, owner_id, from, to })` cu paginare.
- `adminConfirmInvoicePayment` / `adminCancelInvoice`
- `adminRevenueSummary()` — încasări lună, restanțe, parteneri pe planuri.
- `adminUpdateBillingSettings` (wraps `admin_update_setting`).

**Cron** prin `src/routes/api/public/hooks/billing-tick.ts` (apelat de pg_cron zilnic 03:00):
- generează facturi recurente la `period_end - recurring_lead_days`,
- trimite remindere (in-app notification + flag email — fără SMTP nou; coadă pentru future Mailgun),
- retrogradează abonamente `grace_until < now()` → `status='free_downgraded'`, audit.

## Sprint 3 — UI

**`/partner/billing`** (sub portalul partener):
- Card "Plan curent" cu plan, perioada, status, buton Upgrade/Schimbă plan.
- Tabelă facturi (proformă/fiscală) cu status badge + buton Descarcă PDF + buton "Vezi instrucțiuni OP".
- Modal "Instrucțiuni OP": IBAN, beneficiar, sumă cu TVA, **cod plată** mare/copiabil, mențiunea "se activează în 1-3 zile lucrătoare după confirmare".
- Formular completare/actualizare date fiscale (IBAN, billing_email, is_vat_payer) — pre-populat cu ANAF.

**`/admin` → modul nou „Facturare parteneri"** (în categoria Business):
- `InvoicesPanel` (DataTable): status, partener, plan, sumă, payment_code, issued/due/paid + acțiuni inline Confirmă plată / Anulează / PDF.
- Drawer detaliu cu formular confirmare (sumă, paid_ref, paid_at).
- `RevenuePanel`: KPI mono (lună curentă confirmată, restanțe, parteneri activi per plan), tabelă agregată.
- `BillingSettingsPanel`: editor pentru `billing_settings` (issuer, prețuri, grace, reminders) → trece prin `admin_update_setting` (versionat + audit).
- Banner avertizare dacă issuer incomplet.

## Sprint 4 — Integrare entitlements + Art. 30

- `partner.functions.ts` migrează la `assertEntitlement(owner_id, 'max_venues')`. Free = `partner_quotas` redus (1 venue, 0 events). Pro/Premium = override din plan.
- `try_record_proximity_hit` adaugă consultarea `partner_active_entitlements` pentru `push_priority`. **Plafonul USER (cooldown 24h, daily cap, quiet hours) neatins** — Premium înseamnă DOAR că partenerul ocupă slot prioritar, NU mai multe slot-uri totale per user.
- Nearby query sortează `featured_in_nearby` deasupra în acelasi bucket de distanță.
- `docs/gdpr-art-30-register.md` + `src/routes/legal.records-of-processing.tsx`: activitate nouă **A20 — Facturare parteneri** (Art. 6(1)(b) executare contract + Art. 6(1)(c) obligație legală fiscală RO; categorii: date business + reprezentant; destinatari: ANAF (la control), contabilitate internă; banca **NU** procesează date user, doar tranzacție B2B; retenție: 10 ani conform Cod Fiscal RO).

## Sprint 5 — AGENTS.md

Adaug regulă permanentă „## REGULĂ — FACTURARE PARTENERI (permanentă)":
- numerotare neîntreruptă per (series, year) DOAR prin `next_invoice_number`,
- nicio activare/extindere abonament fără `admin_confirm_invoice_payment` (audit obligatoriu),
- preț + TVA citite DOAR din `app_settings.billing_settings` (zero hardcode),
- entitlements citite server-side prin `partner_active_entitlements` (UI doar reflectă),
- plafoanele USER de notificări (cooldown, daily cap, quiet hours) **neatinse** de planuri,
- degradare = retrogradare la Free, **NICIODATĂ ștergere conținut**,
- niciun procesator de plată extern fără actualizare subprocesatori + Art. 30.

## Confirmare contract final

(a) Factura include detalii OP (IBAN, beneficiar, bancă, sumă) + `payment_code` unic mențiune.
(b) `admin_confirm_invoice_payment` activează abonamentul + scrie `admin_audit_log` (severitate `info`, `actor`, `target_invoice`, `before/after`).
(c) Cron-ul zilnic generează factură recurentă cu `recurring_lead_days` înainte + trimite reminder in-app la `reminder_days`.
(d) Degradare = `status='free_downgraded'`, conținutul RĂMÂNE vizibil în limitele Free (1 venue rămâne, restul ascunse via `nearby_points` care filtrează după entitlements).
(e) Numerotare: `next_invoice_number(series, year)` cu lock — secvențial, fără goluri, resetat anual.
(f) `try_record_proximity_hit` neatins — plafoanele USER rămân absolute.

## Întrebare înainte să încep

Confirmi:
1. **Emitent factură**: persoană juridică ONG / SRL care va emite — îmi dai datele tale (denumire, CUI, Reg.Com., adresă, IBAN, bancă) **acum în chat** ca să le seed-uiesc în `billing_settings`, **sau** las placeholder „⚠️ Completează în Admin → Billing Settings înainte de a accepta plăți" și le pui tu prin UI?
2. **Prețuri inițiale RO**: confirm Pro 245 RON/lună (~49€), Premium 745 RON/lună (~149€), Boost 45–145 RON? Sau alte valori?
3. **Seria facturi**: `VTZ` (Ventuza)? Sau alta?
