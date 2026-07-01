
-- ============= VALUL 3 P0 LEGAL SURVIVAL =============

-- 1) NCMEC Queue for CSAM reports
CREATE TABLE public.csam_ncmec_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csam_report_id UUID NOT NULL REFERENCES public.csam_reports(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','filed','failed','withdrawn')),
  ncmec_case_id TEXT,
  filed_by UUID REFERENCES auth.users(id),
  filed_at TIMESTAMPTZ,
  narrative TEXT NOT NULL,
  hash_sha256 TEXT,
  hash_perceptual TEXT,
  affected_country TEXT,
  error_msg TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX csam_ncmec_queue_status_idx ON public.csam_ncmec_queue(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.csam_ncmec_queue TO authenticated;
GRANT ALL ON public.csam_ncmec_queue TO service_role;
ALTER TABLE public.csam_ncmec_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage ncmec queue" ON public.csam_ncmec_queue
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- 2) Breach 72h extensions
ALTER TABLE public.breach_incidents
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS art33_draft TEXT,
  ADD COLUMN IF NOT EXISTS art34_draft TEXT,
  ADD COLUMN IF NOT EXISTS containment_actions TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 3) DSA Statement of Reasons (Art. 17 DSA + transparency Art. 15/24)
CREATE TABLE public.dsa_sor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('content_removed','content_demoted','account_suspended','account_banned','account_restricted','feature_restricted')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_content_type TEXT,
  target_content_id TEXT,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('tos_violation','illegal_content_local','illegal_content_eu','dsa_notice','court_order','safety_measure')),
  category TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  automated BOOLEAN NOT NULL DEFAULT false,
  redress_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 months'),
  appeal_id UUID REFERENCES public.appeals(id) ON DELETE SET NULL,
  transparency_reported BOOLEAN NOT NULL DEFAULT false,
  transparency_period TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dsa_sor_created_idx ON public.dsa_sor(created_at DESC);
CREATE INDEX dsa_sor_target_idx ON public.dsa_sor(target_user_id);
CREATE INDEX dsa_sor_transparency_idx ON public.dsa_sor(transparency_reported, created_at);
GRANT SELECT, INSERT, UPDATE ON public.dsa_sor TO authenticated;
GRANT ALL ON public.dsa_sor TO service_role;
ALTER TABLE public.dsa_sor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage dsa sor" ON public.dsa_sor
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Users view own sor" ON public.dsa_sor
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

-- 4) Country risk config
CREATE TABLE public.country_risk_config (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('normal','elevated','high','blocked')),
  hide_precise_location BOOLEAN NOT NULL DEFAULT false,
  force_stealth BOOLEAN NOT NULL DEFAULT false,
  disable_discover BOOLEAN NOT NULL DEFAULT false,
  disable_signup BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.country_risk_config TO authenticated, anon;
GRANT ALL ON public.country_risk_config TO service_role;
ALTER TABLE public.country_risk_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read country risk" ON public.country_risk_config
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage country risk" ON public.country_risk_config
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Seed hostile jurisdictions (SPLC/ILGA-World criminalization list, non-exhaustive)
INSERT INTO public.country_risk_config (country_code, country_name, risk_level, hide_precise_location, force_stealth, disable_discover, disable_signup, reason) VALUES
  ('UG', 'Uganda', 'blocked', true, true, true, true, 'Anti-Homosexuality Act 2023 — death penalty'),
  ('SA', 'Saudi Arabia', 'blocked', true, true, true, true, 'Criminalizare + pedeapsă capitală'),
  ('IR', 'Iran', 'blocked', true, true, true, true, 'Criminalizare + pedeapsă capitală'),
  ('AE', 'United Arab Emirates', 'high', true, true, true, false, 'Criminalizare, entrapment prin apps'),
  ('EG', 'Egypt', 'high', true, true, true, false, 'Entrapment activ prin apps de dating'),
  ('QA', 'Qatar', 'high', true, true, true, false, 'Criminalizare'),
  ('KW', 'Kuwait', 'high', true, true, true, false, 'Criminalizare'),
  ('MY', 'Malaysia', 'high', true, true, false, false, 'Criminalizare'),
  ('NG', 'Nigeria', 'high', true, true, false, false, 'Same-Sex Marriage Prohibition Act'),
  ('RU', 'Russia', 'high', true, true, false, false, 'LGBT "extremist" designation 2023'),
  ('TR', 'Turkey', 'elevated', false, false, false, false, 'Restricții evenimente publice')
ON CONFLICT (country_code) DO NOTHING;

-- 5) ANAF e-Factura queue
CREATE TABLE public.anaf_efactura_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.partner_invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generated','submitted','accepted','rejected','failed')),
  ubl_xml TEXT,
  anaf_upload_id TEXT,
  anaf_response TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  error_msg TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id)
);
CREATE INDEX anaf_efactura_status_idx ON public.anaf_efactura_queue(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.anaf_efactura_queue TO authenticated;
GRANT ALL ON public.anaf_efactura_queue TO service_role;
ALTER TABLE public.anaf_efactura_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage anaf queue" ON public.anaf_efactura_queue
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Auto-enqueue e-Factura when invoice is issued
CREATE OR REPLACE FUNCTION public.enqueue_efactura_on_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.anaf_efactura_queue (invoice_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (invoice_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enqueue_efactura ON public.partner_invoices;
CREATE TRIGGER trg_enqueue_efactura
  AFTER INSERT ON public.partner_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_efactura_on_invoice();

-- Backfill existing invoices
INSERT INTO public.anaf_efactura_queue (invoice_id, status)
SELECT id, 'pending' FROM public.partner_invoices
ON CONFLICT (invoice_id) DO NOTHING;

-- 6) Breach timeline helper
CREATE OR REPLACE FUNCTION public.breach_add_timeline_event(
  _breach_id UUID, _kind TEXT, _note TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.breach_incidents
    SET timeline = timeline || jsonb_build_object(
      'at', now(), 'kind', _kind, 'note', _note, 'by', auth.uid()
    )
  WHERE id = _breach_id;
END $$;
GRANT EXECUTE ON FUNCTION public.breach_add_timeline_event(UUID, TEXT, TEXT) TO authenticated;

-- 7) DSA SoR creation RPC (used from moderation)
CREATE OR REPLACE FUNCTION public.dsa_record_sor(
  _action_type TEXT, _target_user_id UUID, _target_content_type TEXT, _target_content_id TEXT,
  _legal_basis TEXT, _category TEXT, _reasoning TEXT, _automated BOOLEAN
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.dsa_sor (
    action_type, target_user_id, target_content_type, target_content_id,
    legal_basis, category, reasoning, automated, created_by
  ) VALUES (
    _action_type, _target_user_id, _target_content_type, _target_content_id,
    _legal_basis, _category, _reasoning, _automated, auth.uid()
  ) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.dsa_record_sor(TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) TO authenticated;

-- 8) Country risk lookup (public, cacheable)
CREATE OR REPLACE FUNCTION public.get_country_risk(_country_code TEXT)
RETURNS TABLE(country_code TEXT, risk_level TEXT, hide_precise_location BOOLEAN, force_stealth BOOLEAN, disable_discover BOOLEAN, disable_signup BOOLEAN, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.country_code, c.risk_level, c.hide_precise_location, c.force_stealth,
         c.disable_discover, c.disable_signup, c.reason
  FROM public.country_risk_config c
  WHERE c.country_code = upper(coalesce(_country_code, ''))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_country_risk(TEXT) TO anon, authenticated;
