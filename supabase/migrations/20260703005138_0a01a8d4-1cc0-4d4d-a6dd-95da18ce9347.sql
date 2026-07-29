
-- 1) Catalog badge-uri
CREATE TABLE public.badge_registry (
  code text PRIMARY KEY,
  target text NOT NULL CHECK (target IN ('user','venue','event')),
  label_i18n jsonb NOT NULL,
  icon text NOT NULL,
  color_class text NOT NULL,
  priority int NOT NULL DEFAULT 0,
  criteria_summary text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.badge_registry TO anon, authenticated;
GRANT ALL ON public.badge_registry TO service_role;

ALTER TABLE public.badge_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badge_registry_read_all" ON public.badge_registry
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- 2) Seed catalog
INSERT INTO public.badge_registry (code, target, label_i18n, icon, color_class, priority, criteria_summary) VALUES
  ('verified',        'user',  '{"ro":"Verificat 18+","en":"Verified 18+"}',   'BadgeCheck',  'text-rose-500',    100, 'Verificare identitate Didit completă (18+).'),
  ('founder',         'user',  '{"ro":"Pionier","en":"Founder"}',              'Sparkles',    'text-amber-400',    90, 'Cont creat înainte de 1 august 2026.'),
  ('streak_7',        'user',  '{"ro":"Activ 7 zile","en":"7-day streak"}',    'Flame',       'text-orange-500',   60, 'Activitate în 7 zile consecutive.'),
  ('matcher',         'user',  '{"ro":"Popular","en":"Popular"}',              'Heart',       'text-fuchsia-500',  50, 'Cel puțin 25 de match-uri reciproce.'),
  ('explorer',        'user',  '{"ro":"Explorator","en":"Explorer"}',          'Compass',     'text-teal-400',     40, 'Activitate în cel puțin 5 orașe diferite.'),
  ('partner_premium', 'venue', '{"ro":"Premium","en":"Premium"}',              'Crown',       'text-amber-500',   100, 'Partener cu plan Premium/Pro activ.'),
  ('partner_boost',   'venue', '{"ro":"Boost","en":"Boost"}',                  'Rocket',      'text-rose-500',     95, 'Boost activ pentru vizibilitate crescută.'),
  ('official',        'venue', '{"ro":"Oficial","en":"Official"}',             'ShieldCheck', 'text-blue-500',     90, 'Local oficial verificat de echipa Suzeta.');

-- 3) RPC user badges
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badges text[] := ARRAY[]::text[];
  v_age_status text;
  v_created_at timestamptz;
  v_matches int;
  v_streak int;
  v_cities int;
BEGIN
  SELECT age_status, created_at INTO v_age_status, v_created_at
  FROM public.profiles WHERE id = _user_id;

  IF v_age_status = 'verified' THEN
    badges := badges || 'verified';
  END IF;

  IF v_created_at IS NOT NULL AND v_created_at < '2026-08-01'::timestamptz THEN
    badges := badges || 'founder';
  END IF;

  SELECT count(*) INTO v_matches
  FROM public.matches
  WHERE user_a = _user_id OR user_b = _user_id;
  IF v_matches >= 25 THEN
    badges := badges || 'matcher';
  END IF;

  -- streak 7: 7 zile distincte consecutive terminate ieri sau azi
  SELECT count(*) INTO v_streak FROM (
    SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS d
    FROM public.xp_events
    WHERE user_id = _user_id
      AND created_at >= now() - interval '10 days'
    ORDER BY d DESC
    LIMIT 7
  ) t;
  IF v_streak >= 7 THEN
    badges := badges || 'streak_7';
  END IF;

  SELECT count(DISTINCT lower(city)) INTO v_cities
  FROM public.xp_events e
  LEFT JOIN public.venues v ON v.id = (e.meta->>'venue_id')::uuid
  WHERE e.user_id = _user_id AND v.city IS NOT NULL;
  IF v_cities >= 5 THEN
    badges := badges || 'explorer';
  END IF;

  RETURN badges;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated, service_role;

-- 4) RPC venue badges
CREATE OR REPLACE FUNCTION public.get_venue_badges(_venue_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badges text[] := ARRAY[]::text[];
  v_owner uuid;
  v_official boolean;
  v_plan text;
  v_boost boolean;
BEGIN
  SELECT owner_id, is_official INTO v_owner, v_official
  FROM public.venues WHERE id = _venue_id;

  IF v_official THEN
    badges := badges || 'official';
  END IF;

  IF v_owner IS NOT NULL THEN
    SELECT plan_code INTO v_plan
    FROM public.partner_subscriptions
    WHERE owner_id = v_owner AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;
    IF v_plan IN ('Premium','Pro') THEN
      badges := badges || 'partner_premium';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.partner_boost_orders
      WHERE owner_id = v_owner AND active = true
        AND ends_at > now() AND starts_at <= now()
    ) INTO v_boost;
    IF v_boost THEN
      badges := badges || 'partner_boost';
    END IF;
  END IF;

  RETURN badges;
END;
$$;

REVOKE ALL ON FUNCTION public.get_venue_badges(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_badges(uuid) TO anon, authenticated, service_role;
