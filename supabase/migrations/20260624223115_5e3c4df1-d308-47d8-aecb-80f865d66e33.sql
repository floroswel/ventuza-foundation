
-- ============ A/B EXPERIMENTS ============
CREATE TABLE IF NOT EXISTS public.experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  variants jsonb NOT NULL DEFAULT '["control","treatment"]'::jsonb,
  weights jsonb NOT NULL DEFAULT '[50,50]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.experiments TO authenticated, anon;
GRANT ALL ON public.experiments TO service_role;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY exp_read ON public.experiments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY exp_admin_write ON public.experiments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variant text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_key, user_id)
);
GRANT SELECT, INSERT ON public.experiment_assignments TO authenticated;
GRANT ALL ON public.experiment_assignments TO service_role;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ea_owner_read ON public.experiment_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY ea_owner_insert ON public.experiment_assignments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.experiment_events (
  id bigserial PRIMARY KEY,
  experiment_key text NOT NULL,
  variant text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exp_events_key_idx ON public.experiment_events (experiment_key, created_at DESC);
GRANT INSERT ON public.experiment_events TO authenticated;
GRANT SELECT ON public.experiment_events TO authenticated;
GRANT ALL ON public.experiment_events TO service_role;
ALTER TABLE public.experiment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ee_insert ON public.experiment_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ee_admin_read ON public.experiment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ REFERRALS ============
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO anon, authenticated;
GRANT INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_public_read ON public.referral_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY rc_owner_write ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY rc_owner_update ON public.referral_codes FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_redemptions TO authenticated;
GRANT ALL ON public.referral_redemptions TO service_role;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rr_party_read ON public.referral_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY rr_self_insert ON public.referral_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_id);

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT owner_id INTO v_owner FROM referral_codes WHERE code = upper(trim(_code));
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  IF v_owner = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'self_referral'); END IF;
  IF EXISTS (SELECT 1 FROM referral_redemptions WHERE referred_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;
  INSERT INTO referral_redemptions(code, referrer_id, referred_id) VALUES (upper(trim(_code)), v_owner, v_uid);
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE code = upper(trim(_code));
  -- Reward: 100 XP each
  UPDATE profiles SET xp = COALESCE(xp,0) + 100 WHERE id IN (v_owner, v_uid);
  RETURN jsonb_build_object('ok', true, 'reward_xp', 100);
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT code INTO v_code FROM referral_codes WHERE owner_id = v_uid LIMIT 1;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO referral_codes(owner_id, code) VALUES (v_uid, v_code);
  RETURN v_code;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;

-- ============ RATE LIMIT ============
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rl_user_action_idx ON public.rate_limit_log (user_id, action, created_at DESC);
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limit_log TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_action text, _max int, _window_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO v_count FROM rate_limit_log
    WHERE user_id = v_uid AND action = _action
      AND created_at > now() - make_interval(secs => _window_seconds);
  IF v_count >= _max THEN RETURN false; END IF;
  INSERT INTO rate_limit_log(user_id, action) VALUES (v_uid, _action);
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO authenticated;

-- ============ FEEDBACK ============
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  page text,
  user_agent text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback TO authenticated;
GRANT SELECT, UPDATE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY fb_self_insert ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY fb_admin_read ON public.feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY fb_admin_update ON public.feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ WEB VITALS ============
CREATE TABLE IF NOT EXISTS public.web_vitals (
  id bigserial PRIMARY KEY,
  user_id uuid,
  metric text NOT NULL,
  value numeric NOT NULL,
  rating text,
  path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wv_metric_idx ON public.web_vitals (metric, created_at DESC);
GRANT INSERT ON public.web_vitals TO anon, authenticated;
GRANT SELECT ON public.web_vitals TO authenticated;
GRANT ALL ON public.web_vitals TO service_role;
ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY wv_insert ON public.web_vitals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY wv_admin_read ON public.web_vitals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ ANALYTICS SUMMARY RPC ============
CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'verified_users', (SELECT count(*) FROM profiles WHERE age_status = 'verified'),
    'dau', (SELECT count(DISTINCT user_id) FROM messages WHERE created_at > now() - interval '1 day'),
    'wau', (SELECT count(DISTINCT user_id) FROM messages WHERE created_at > now() - interval '7 days'),
    'mau', (SELECT count(DISTINCT user_id) FROM messages WHERE created_at > now() - interval '30 days'),
    'msg_24h', (SELECT count(*) FROM messages WHERE created_at > now() - interval '1 day'),
    'matches_24h', (SELECT count(*) FROM matches WHERE created_at > now() - interval '1 day'),
    'new_users_7d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'reports_open', (SELECT count(*) FROM reports WHERE status = 'open'),
    'business_pending', (SELECT count(*) FROM business_applications WHERE status = 'pending'),
    'ads_pending', (SELECT count(*) FROM ad_campaigns WHERE status = 'pending'),
    'feedback_new', (SELECT count(*) FROM feedback WHERE status = 'new')
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary() TO authenticated;
