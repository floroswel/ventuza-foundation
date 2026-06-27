# Monetizare parteneri — plan de implementare

Sistem complet de monetizare B2B peste portalul partener + moderare + nearby existente. Respectă strict toate regulile din AGENTS.md, în special **plafonul anti-spam al userului rămâne intact**.

## Principiu non-negociabil (confirmat în cod)

Planurile dau partenerului **prioritate** pentru un slot, nu dreptul la sloturi suplimentare. Gate-ul `public.try_record_proximity_hit` (8/zi, cooldown 24h, quiet hours) NU se atinge. Singura interacțiune cu planurile: când userul are sloturi disponibile și mai mulți parteneri concurează, sortarea folosește `plan_priority` ca tie-breaker.

## A. Schemă DB (migrare unică)

**Tabele noi:**
- `partner_plans` — `code` (basic/pro/premium), `name`, `price_eur_cents`, `stripe_price_id`, `entitlements jsonb` (max_venues, push_priority 0-100, badge_verified, stats_level, sort_boost, sponsored_offers, ad_banner), `active`.
- `partner_subscriptions` — `user_id`, `plan_code`, `status` (active/grace/past_due/canceled), `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `grace_until`, `cancel_at`, `started_at`. RLS: owner SELECT, service_role ALL.
- `partner_boosts` — `id`, `owner_id`, `target_kind` (event/offer/venue), `target_id`, `boost_type`, `starts_at`, `ends_at`, `price_eur_cents`, `stripe_payment_intent_id`, `status`.
- `partner_invoices` — `user_id`, `stripe_invoice_id`, `amount_cents`, `currency`, `status`, `pdf_url`, `period_start`, `period_end`, `cui`, `business_name` (facturare).
- `ad_transparency_log` (DSA Art. 39) — `id`, `advertiser_user_id`, `item_kind`, `item_id`, `placement` (sponsored_offer/promoted_banner/top_position/boost), `started_at`, `ended_at`, `paid_cents`, `reason`.
- `app_settings` key `partner_billing`: `grace_days=7`, `currency=eur`, `boost_prices`, `enforce_eu_vat=true`.

**Coloane noi pe existente:**
- `profiles`: `current_plan_code text default 'free'`, `plan_active boolean default false`, `reduce_sponsored boolean default false` (pentru Premium/Founder user toggle).
- `venues/events/offers`: `is_sponsored boolean generated` derivat din boost activ + plan; `sponsored_label_required boolean` (always true când is_sponsored).

**Funcții SQL noi:**
- `partner_active_plan(uid) returns text` — întoarce plan code curent (basic dacă nu plătit / în grace expirat).
- `partner_entitlement(uid, key) returns jsonb`.
- `assert_partner_entitlement(uid, key, required)` — RAISE dacă nu îndeplinește.
- Modificare `nearby_points`: adaugă `plan_priority` în payload (DOAR pentru sortare); NU schimbă cantitatea de items returnate.
- Modificare `try_record_proximity_hit`: **fără schimbări la plafoane**. Doar log adițional cu `plan_priority` pentru transparență.

## B. Stripe (procesator nou)

- Enable Stripe payments via `enable_stripe_payments` (NU BYOK). Tax handling: `automatic_tax` (RO/EU VAT).
- Produse: 3 subscription products (Basic/Pro/Premium) + 1-time products pentru boost types.
- Server fns (`src/lib/partner-billing.functions.ts`):
  - `createCheckoutSession({plan_code})` — subscription
  - `createBoostCheckoutSession({target_kind, target_id, boost_type})` — one-time
  - `cancelSubscription()`, `openCustomerPortal()`, `getMySubscription()`, `getMyInvoices()`.
- Webhook `/api/public/stripe-webhook` cu verificare signature:
  - `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid/payment_failed` → update `partner_subscriptions`, set `current_plan_code` pe profile.
  - Eșec plată → setează `status='past_due'`, `grace_until=now()+7d`. Cron zilnic retrogradează la Basic după grace.
- **NU stocăm date card.** Doar `stripe_customer_id`, `stripe_subscription_id`, plan, status.
- **Separare Google Play**: portal `/partner` e web-only B2B. Verificare în `src/lib/google-play.server.ts` să nu accepte SKU-uri de plan partener. Capacitor build ascunde butoanele de upgrade plan în `/partner` dacă `Capacitor.isNativePlatform()` — redirect "deschide în browser".

## C. Degradare (retrogradare, nu ștergere)

- Cron `partner_downgrade_expired()` rulat zilnic: subs în `past_due` cu `grace_until < now()` → set plan `basic`, dezactivează push priority, ascunde locații peste limita Basic (set `is_published=false` pe surplus, ordonate desc după created_at), revocă boost-uri active.
- Reluare plată → webhook readuce plan-ul; trigger reactivează venues (`is_published=true` PÂNĂ LA `moderation_status='approved'` check; cele care erau aprobate înainte revin publice).
- Notificări in-app + email la grace start, grace end, retrogradare, reactivare.

## D. Sponsored — marcaj automat obligatoriu

- View SQL `is_sponsored_now(item_kind, item_id)` — true dacă există `partner_boosts.status='active' AND now() BETWEEN starts_at AND ends_at` SAU plan owner are `sponsored_offers=true` și itemul e marcat promoted.
- Componenta `<SponsoredBadge />` randată **automat** în `NearbyCard`, `OfferCard`, `SponsoredBanner` când `is_sponsored=true`. Eticheta vine din server payload — partenerul nu o poate ascunde.
- Orice insert în `partner_boosts.status='active'` scrie automat în `ad_transparency_log` (trigger).
- Pagina publică `/legal/ad-transparency` listează agregat (fără PII user) reclamele active conform DSA Art. 39.

## E. User control (Premium / Founder)

- Toggle în `/settings` → `profiles.reduce_sponsored`. Când true:
  - `nearby_points` reduce ponderea `plan_priority` la 0 pentru userul ăsta (sortare pur geografică).
  - `SponsoredBanner` ascuns.
  - Conținutul organic neatins.
- Gate: doar useri cu `is_premium` SAU `is_founder`. Verificat server-side.

## F. Admin dashboard venituri

- Modul nou `src/components/admin/RevenuePanel.tsx` în `/admin`:
  - KPI: MRR, parteneri activi/plan, churn 30d, boost-uri vândute, venit total luna.
  - Listă parteneri cu plan, status, valoare lunară, started_at — **fără date card**.
  - Editor `partner_plans` (preț, entitlements) → scrie via `admin_update_setting` + audit critical.
  - Acordare manuală plan: `adminGrantPlan({user_id, plan_code, reason, expires_at})` — audit `critical`, scrie în `partner_subscriptions` cu `stripe_*=null` și flag `manual_grant=true`.
  - Vizualizare `ad_transparency_log`.
- Server fns în `src/lib/admin-revenue.functions.ts`, toate gated pe `is_admin_or_above`. Citesc doar metadate; nu apelează Stripe pentru date sensibile.

## G. AGENTS.md — reguli noi

- **REGULĂ — MONETIZARE NU SLĂBEȘTE PROTECȚIA USERULUI**: plafoanele `try_record_proximity_hit` (daily_cap, cooldown, quiet hours) nu pot fi schimbate de un plan/boost/entitlement. Orice diff care le citește din plan trebuie REFUZAT.
- **REGULĂ — SPONSORED MARKING OBLIGATORIU**: orice item cu boost activ sau în slot promoted poartă badge `Sponsorizat` randat server-side. UI partener nu poate dezactiva. Diff care expune un câmp `hide_sponsored` partenerului → REFUZAT.
- **REGULĂ — PLATĂ PARTENER ≠ GOOGLE PLAY BILLING**: planuri/boost-uri parteneri se vând exclusiv prin Stripe pe web `/partner`. Build mobil nu expune checkout-ul. Diff care adaugă SKU partener în Google Play sau acceptă RTDN pentru plan partener → REFUZAT.
- **REGULĂ — NEPLATA RETROGRADEAZĂ, NU ȘTERGE**: niciun DELETE pe `venues/events/offers` declanșat de eveniment Stripe. Doar `is_published=false` reversibil.

## H. Legal updates (aceeași migrare)

- `src/routes/legal.subprocessors.tsx`: adaugă Stripe Payments Europe (Irlanda; EU + transfer DPF SUA pentru fraud; date business: nume, email, CUI; **niciodată** date de useri finali; DPA: stripe.com/legal/dpa).
- `docs/gdpr-art-30-register.md` + `src/routes/legal.records-of-processing.tsx`: activitate nouă "Facturare parteneri B2B" — temei Art. 6(1)(b) executare contract + Art. 6(1)(c) obligație fiscală; nu Art. 9; retenție 10 ani (Cod Fiscal RO).
- Fără kind nou de consimțământ user (B2B contractual).

## I. Confirmări de cerut la final

(a) `try_record_proximity_hit` rămâne identic — diff zero pe plafoane. ✅
(b) Stripe = procesator nou declarat; Google Play Billing intact și separat. ✅
(c) Webhook retrogradează plan + ascunde surplus; nicio ștergere. ✅
(d) `SponsoredBadge` randat din server payload, automat. ✅
(e) Admin vede plan/status/MRR, niciodată PAN/CVV/expiry. ✅

---

## Fișiere afectate (estimat)

**Noi (~14):**
- migrare SQL: plans/subscriptions/boosts/invoices/ad_log/columns/functions/cron
- `src/lib/partner-billing.functions.ts`, `src/lib/admin-revenue.functions.ts`
- `src/routes/api/public/stripe-webhook.ts`
- `src/routes/partner.billing.tsx` (plan picker, invoices, customer portal link)
- `src/components/partner/PlanPicker.tsx`, `BoostDialog.tsx`, `SubscriptionStatusCard.tsx`
- `src/components/SponsoredBadge.tsx`, `src/components/admin/RevenuePanel.tsx`
- `src/lib/sponsored.ts` (helper)

**Modificate (~10):**
- `src/lib/nearby.functions.ts` (adaugă plan_priority + is_sponsored la payload, fără a crește count)
- `src/components/nearby/NearbyCard.tsx`, `SponsoredBanner.tsx`, `OfferCard.tsx` (badge auto)
- `src/routes/partner.tsx` (link la billing + status bar)
- `src/routes/admin.tsx` (mount RevenuePanel)
- `src/routes/settings.tsx` (toggle reduce_sponsored pentru Premium/Founder)
- `src/lib/partner.functions.ts` (assertEntitlement la create/publish)
- `src/routes/legal.subprocessors.tsx`, `docs/gdpr-art-30-register.md`, `src/routes/legal.records-of-processing.tsx`
- `AGENTS.md` (+4 reguli)

## Acțiuni manuale necesare din partea ta

1. **Aprobă activarea Stripe Payments** (built-in Lovable, fără cont propriu necesar). După aprobare, definim cele 3 produse subscription + boost-urile.
2. Confirmi prețurile inițiale (sau le pun placeholder Basic 0€ / Pro 29€/lună / Premium 99€/lună, boost 5€/3zile — modificabile din admin).

Aștept confirmarea ta înainte să încep implementarea.
