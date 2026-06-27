
-- ============================================================
-- PARTNER BILLING SYSTEM — bank transfer (OP) + manual admin confirm
-- ============================================================

-- 1) Extensii pe business_applications
ALTER TABLE public.business_applications
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS is_vat_payer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_completed_at timestamptz;

-- 2) partner_plans
CREATE TABLE IF NOT EXISTS public.partner_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_plans TO anon, authenticated;
GRANT ALL ON public.partner_plans TO service_role;
ALTER TABLE public.partner_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_plans public read" ON public.partner_plans FOR SELECT USING (active = true);
CREATE POLICY "partner_plans staff manage" ON public.partner_plans FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.partner_plans(code, name, description, entitlements, sort_order) VALUES
  ('Free','Free','Listare de bază, 1 venue, fără push prioritizat.',
   '{"max_venues":1,"max_events":2,"max_offers":2,"push_priority":"none","featured_in_nearby":false,"badge_verified":false,"can_create_boost":false,"max_notifications_per_day":0}'::jsonb, 1),
  ('Pro','Pro','5 venues, analytics, push prioritate medie, badge verificat.',
   '{"max_venues":5,"max_events":20,"max_offers":10,"push_priority":"medium","featured_in_nearby":false,"badge_verified":true,"can_create_boost":true,"max_notifications_per_day":1}'::jsonb, 2),
  ('Premium','Premium','Venues nelimitate, featured, push prioritate maximă, oferte promovate.',
   '{"max_venues":999,"max_events":999,"max_offers":999,"push_priority":"high","featured_in_nearby":true,"badge_verified":true,"can_create_boost":true,"max_notifications_per_day":3}'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;

-- 3) partner_subscriptions (per owner)
CREATE TABLE IF NOT EXISTS public.partner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.partner_plans(code) DEFAULT 'Free',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','grace','free_downgraded','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  last_invoice_id uuid,
  auto_invoice boolean NOT NULL DEFAULT true,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_subscriptions TO authenticated;
GRANT ALL ON public.partner_subscriptions TO service_role;
ALTER TABLE public.partner_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psub owner read" ON public.partner_subscriptions FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "psub staff read" ON public.partner_subscriptions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 4) partner_invoice_counters
CREATE TABLE IF NOT EXISTS public.partner_invoice_counters (
  series text NOT NULL,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  PRIMARY KEY (series, year)
);
GRANT SELECT ON public.partner_invoice_counters TO authenticated;
GRANT ALL ON public.partner_invoice_counters TO service_role;
ALTER TABLE public.partner_invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pic staff read" ON public.partner_invoice_counters FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_invoice_number(_series text, _year int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.partner_invoice_counters(series, year, next_number)
    VALUES (_series, _year, 1)
    ON CONFLICT (series, year) DO NOTHING;
  UPDATE public.partner_invoice_counters
     SET next_number = next_number + 1
   WHERE series = _series AND year = _year
   RETURNING next_number - 1 INTO n;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.next_invoice_number(text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(text,int) TO service_role;

-- 5) partner_invoices
CREATE TABLE IF NOT EXISTS public.partner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series text NOT NULL,
  number int NOT NULL,
  year int NOT NULL,
  payment_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('subscription','boost')),
  plan_code text REFERENCES public.partner_plans(code),
  boost_event_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  currency text NOT NULL DEFAULT 'RON',
  subtotal_minor int NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 19,
  vat_minor int NOT NULL,
  total_minor int NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('draft','pending_payment','paid','overdue','cancelled','refunded')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  paid_amount_minor int,
  paid_ref text,
  confirmed_by uuid REFERENCES auth.users(id),
  notes text,
  billing_snapshot jsonb NOT NULL,
  issuer_snapshot jsonb NOT NULL,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series, year, number)
);
CREATE INDEX IF NOT EXISTS idx_pinv_owner ON public.partner_invoices(owner_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_pinv_status ON public.partner_invoices(status, due_at);
GRANT SELECT ON public.partner_invoices TO authenticated;
GRANT ALL ON public.partner_invoices TO service_role;
ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pinv owner read" ON public.partner_invoices FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "pinv staff read" ON public.partner_invoices FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 6) partner_boost_orders
CREATE TABLE IF NOT EXISTS public.partner_boost_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.partner_invoices(id) ON DELETE CASCADE,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pbo_active ON public.partner_boost_orders(active, ends_at) WHERE active;
GRANT SELECT ON public.partner_boost_orders TO authenticated;
GRANT ALL ON public.partner_boost_orders TO service_role;
ALTER TABLE public.partner_boost_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbo owner read" ON public.partner_boost_orders FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "pbo staff read" ON public.partner_boost_orders FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 7) billing_settings în app_settings (singura sursă de adevăr pentru preț + emitent)
INSERT INTO public.app_settings(key, value, description, updated_by)
VALUES (
  'billing_settings',
  jsonb_build_object(
    'issuer', jsonb_build_object(
      'name','⚠️ COMPLETEAZĂ în Admin → Billing Settings',
      'cui','', 'reg_com','', 'address','', 'iban','', 'bank','', 'email',''
    ),
    'invoice_series','VTZ',
    'vat_rate', 19,
    'currency','RON',
    'grace_days', 7,
    'reminder_days', '[3,7,10]'::jsonb,
    'recurring_lead_days', 7,
    'due_days', 7,
    'prices', jsonb_build_object(
      'Pro', jsonb_build_object('monthly_minor', 24500),
      'Premium', jsonb_build_object('monthly_minor', 74500),
      'Boost', jsonb_build_object('min_minor', 4500, 'max_minor', 14500)
    )
  ),
  'Setări facturare parteneri (emitent, prețuri RON, TVA, grace, remindere).',
  NULL
) ON CONFLICT (key) DO NOTHING;

-- 8) RPC partner_active_entitlements
CREATE OR REPLACE FUNCTION public.partner_active_entitlements(_owner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.entitlements
       FROM public.partner_subscriptions s
       JOIN public.partner_plans p ON p.code = s.plan_code
      WHERE s.owner_id = _owner_id
        AND s.status IN ('active','grace')
        AND (s.current_period_end IS NULL OR s.current_period_end > now()
             OR (s.status='grace' AND s.grace_until > now()))
      LIMIT 1),
    (SELECT entitlements FROM public.partner_plans WHERE code='Free')
  );
$$;
GRANT EXECUTE ON FUNCTION public.partner_active_entitlements(uuid) TO authenticated, service_role;

-- Auto-create Free subscription pentru orice partener aprobat
CREATE OR REPLACE FUNCTION public.partner_ensure_free_sub()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.partner_subscriptions(owner_id, plan_code, status)
    VALUES (NEW.user_id, 'Free', 'active')
    ON CONFLICT (owner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_partner_ensure_free_sub ON public.business_applications;
CREATE TRIGGER trg_partner_ensure_free_sub
  AFTER UPDATE ON public.business_applications
  FOR EACH ROW EXECUTE FUNCTION public.partner_ensure_free_sub();

-- Backfill: parteneri aprobați fără sub → Free
INSERT INTO public.partner_subscriptions(owner_id, plan_code, status)
  SELECT DISTINCT ba.user_id, 'Free', 'active'
    FROM public.business_applications ba
   WHERE ba.status='approved'
     AND NOT EXISTS (SELECT 1 FROM public.partner_subscriptions s WHERE s.owner_id = ba.user_id)
ON CONFLICT (owner_id) DO NOTHING;

-- 9) RPC: partner_create_invoice (apelat de server fn)
CREATE OR REPLACE FUNCTION public.partner_create_invoice(
  _owner_id uuid,
  _kind text,
  _plan_code text DEFAULT NULL,
  _boost_event_id uuid DEFAULT NULL,
  _boost_price_minor int DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _settings jsonb;
  _series text; _year int; _n int;
  _subtotal int; _vat_rate numeric; _vat int; _total int;
  _currency text; _due_days int;
  _ba record; _billing jsonb; _issuer jsonb;
  _id uuid; _code text;
  _ps timestamptz; _pe timestamptz;
BEGIN
  IF _kind NOT IN ('subscription','boost') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  SELECT value INTO _settings FROM public.app_settings WHERE key='billing_settings';
  IF _settings IS NULL THEN RAISE EXCEPTION 'billing_settings_missing'; END IF;
  _series := COALESCE(_settings->>'invoice_series','VTZ');
  _vat_rate := COALESCE((_settings->>'vat_rate')::numeric, 19);
  _currency := COALESCE(_settings->>'currency','RON');
  _due_days := COALESCE((_settings->>'due_days')::int, 7);
  _issuer := _settings->'issuer';
  _year := EXTRACT(YEAR FROM now())::int;

  IF _kind = 'subscription' THEN
    IF _plan_code IS NULL OR _plan_code = 'Free' THEN RAISE EXCEPTION 'invalid_plan'; END IF;
    _subtotal := COALESCE((_settings#>>ARRAY['prices',_plan_code,'monthly_minor'])::int, 0);
    IF _subtotal <= 0 THEN RAISE EXCEPTION 'price_not_configured'; END IF;
    _ps := date_trunc('day', now());
    _pe := _ps + INTERVAL '1 month';
  ELSE
    IF _boost_event_id IS NULL OR _boost_price_minor IS NULL THEN RAISE EXCEPTION 'boost_params_required'; END IF;
    IF _boost_price_minor < COALESCE((_settings#>>ARRAY['prices','Boost','min_minor'])::int, 0)
       OR _boost_price_minor > COALESCE((_settings#>>ARRAY['prices','Boost','max_minor'])::int, 999999) THEN
      RAISE EXCEPTION 'boost_price_out_of_range';
    END IF;
    _subtotal := _boost_price_minor;
  END IF;

  _vat := ROUND(_subtotal * _vat_rate / 100.0)::int;
  _total := _subtotal + _vat;

  SELECT brand_name, legal_name, cui, reg_com, address, iban, billing_email, is_vat_payer
    INTO _ba FROM public.business_applications
   WHERE user_id = _owner_id AND status='approved'
   ORDER BY updated_at DESC LIMIT 1;
  IF _ba.legal_name IS NULL THEN RAISE EXCEPTION 'partner_not_approved'; END IF;
  _billing := jsonb_build_object(
    'legal_name', _ba.legal_name, 'brand_name', _ba.brand_name,
    'cui', _ba.cui, 'reg_com', _ba.reg_com, 'address', _ba.address,
    'iban', _ba.iban, 'billing_email', _ba.billing_email, 'is_vat_payer', _ba.is_vat_payer
  );

  _n := public.next_invoice_number(_series, _year);
  _code := _series || '-' || _year::text || '-' || lpad(_n::text, 4, '0');
  _id := gen_random_uuid();

  INSERT INTO public.partner_invoices(
    id, owner_id, series, number, year, payment_code, kind, plan_code, boost_event_id,
    period_start, period_end, currency, subtotal_minor, vat_rate, vat_minor, total_minor,
    status, issued_at, due_at, billing_snapshot, issuer_snapshot
  ) VALUES (
    _id, _owner_id, _series, _n, _year, _code, _kind, _plan_code, _boost_event_id,
    _ps, _pe, _currency, _subtotal, _vat_rate, _vat, _total,
    'pending_payment', now(), now() + (_due_days || ' days')::interval, _billing, _issuer
  );

  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.partner_create_invoice(uuid,text,text,uuid,int) TO service_role;

-- 10) RPC: admin_confirm_invoice_payment
CREATE OR REPLACE FUNCTION public.admin_confirm_invoice_payment(
  _invoice_id uuid,
  _amount_minor int,
  _paid_ref text,
  _paid_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _inv record; _new_end timestamptz; _sub record;
BEGIN
  IF NOT public.is_staff(_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _inv FROM public.partner_invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF _inv.status NOT IN ('pending_payment','overdue') THEN RAISE EXCEPTION 'invoice_not_payable'; END IF;

  UPDATE public.partner_invoices
     SET status='paid', paid_at=_paid_at, paid_amount_minor=_amount_minor,
         paid_ref=_paid_ref, confirmed_by=_actor, updated_at=now()
   WHERE id=_invoice_id;

  IF _inv.kind = 'subscription' THEN
    SELECT * INTO _sub FROM public.partner_subscriptions WHERE owner_id=_inv.owner_id FOR UPDATE;
    _new_end := GREATEST(COALESCE(_sub.current_period_end, now()), now()) + INTERVAL '1 month';
    UPDATE public.partner_subscriptions
       SET plan_code = _inv.plan_code,
           status = 'active',
           current_period_start = COALESCE(current_period_start, now()),
           current_period_end = _new_end,
           grace_until = NULL,
           last_invoice_id = _invoice_id,
           updated_at = now()
     WHERE owner_id = _inv.owner_id;
  ELSIF _inv.kind = 'boost' THEN
    INSERT INTO public.partner_boost_orders(owner_id, event_id, invoice_id, starts_at, ends_at, active)
    VALUES (_inv.owner_id, _inv.boost_event_id, _invoice_id, now(), now() + INTERVAL '48 hours', true);
  END IF;

  PERFORM public.log_admin_action(
    _actor, 'partner_invoice_confirm_payment', 'partner_invoices', _invoice_id,
    jsonb_build_object('status', _inv.status),
    jsonb_build_object('status','paid','amount_minor',_amount_minor,'paid_ref',_paid_ref,'owner_id',_inv.owner_id,'kind',_inv.kind),
    'info'
  );
  RETURN _invoice_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_confirm_invoice_payment(uuid,int,text,timestamptz) TO authenticated, service_role;

-- 11) RPC: admin_cancel_invoice
CREATE OR REPLACE FUNCTION public.admin_cancel_invoice(_invoice_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _actor uuid := auth.uid(); _inv record;
BEGIN
  IF NOT public.is_staff(_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _inv FROM public.partner_invoices WHERE id=_invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF _inv.status IN ('paid','refunded') THEN RAISE EXCEPTION 'cannot_cancel_paid'; END IF;
  UPDATE public.partner_invoices SET status='cancelled', notes=COALESCE(notes,'')||E'\n[cancel] '||COALESCE(_reason,''), updated_at=now() WHERE id=_invoice_id;
  PERFORM public.log_admin_action(_actor,'partner_invoice_cancel','partner_invoices',_invoice_id,
    to_jsonb(_inv), jsonb_build_object('status','cancelled','reason',_reason),'warning');
  RETURN _invoice_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_cancel_invoice(uuid,text) TO authenticated, service_role;

-- 12) RPC cron: billing_tick (recurență + remindere + retrogradare)
CREATE OR REPLACE FUNCTION public.billing_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _settings jsonb;
  _lead int; _grace int;
  _generated int := 0; _downgraded int := 0; _overdue int := 0;
  _s record; _new_inv uuid;
BEGIN
  SELECT value INTO _settings FROM public.app_settings WHERE key='billing_settings';
  _lead := COALESCE((_settings->>'recurring_lead_days')::int, 7);
  _grace := COALESCE((_settings->>'grace_days')::int, 7);

  -- Generează facturi recurente
  FOR _s IN
    SELECT s.* FROM public.partner_subscriptions s
     WHERE s.status IN ('active','grace')
       AND s.auto_invoice = true
       AND s.plan_code <> 'Free'
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end <= now() + (_lead || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM public.partner_invoices i
          WHERE i.owner_id=s.owner_id AND i.kind='subscription'
            AND i.status IN ('pending_payment','overdue')
            AND i.period_start >= s.current_period_end - INTERVAL '1 day'
       )
  LOOP
    BEGIN
      _new_inv := public.partner_create_invoice(_s.owner_id,'subscription',_s.plan_code,NULL,NULL);
      _generated := _generated + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- Marchează overdue
  UPDATE public.partner_invoices SET status='overdue', updated_at=now()
   WHERE status='pending_payment' AND due_at < now();
  GET DIAGNOSTICS _overdue = ROW_COUNT;

  -- Grace → free_downgraded
  UPDATE public.partner_subscriptions
     SET status='grace', grace_until = current_period_end + (_grace||' days')::interval, updated_at=now()
   WHERE status='active' AND plan_code <> 'Free'
     AND current_period_end < now() AND grace_until IS NULL;

  UPDATE public.partner_subscriptions
     SET status='free_downgraded', plan_code='Free', updated_at=now()
   WHERE status='grace' AND grace_until < now();
  GET DIAGNOSTICS _downgraded = ROW_COUNT;

  RETURN jsonb_build_object('generated',_generated,'overdue',_overdue,'downgraded',_downgraded,'at',now());
END $$;
GRANT EXECUTE ON FUNCTION public.billing_tick() TO service_role;

-- 13) updated_at triggers
CREATE TRIGGER trg_psub_updated BEFORE UPDATE ON public.partner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pinv_updated BEFORE UPDATE ON public.partner_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pplans_updated BEFORE UPDATE ON public.partner_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
