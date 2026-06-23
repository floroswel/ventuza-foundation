
-- 1) Device fingerprints (anti-ban-evasion)
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, user_id)
);
CREATE INDEX IF NOT EXISTS device_fp_fp_idx ON public.device_fingerprints(fingerprint);
CREATE INDEX IF NOT EXISTS device_fp_user_idx ON public.device_fingerprints(user_id);

GRANT SELECT, INSERT, UPDATE ON public.device_fingerprints TO authenticated;
GRANT ALL ON public.device_fingerprints TO service_role;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own fingerprints" ON public.device_fingerprints
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user inserts own fingerprints" ON public.device_fingerprints
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own fingerprints" ON public.device_fingerprints
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Banned fingerprints
CREATE TABLE IF NOT EXISTS public.banned_fingerprints (
  fingerprint text PRIMARY KEY,
  reason text,
  banned_by uuid REFERENCES auth.users(id),
  banned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banned_fingerprints TO authenticated;
GRANT ALL ON public.banned_fingerprints TO service_role;
ALTER TABLE public.banned_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage banned fps" ON public.banned_fingerprints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Helper: check fingerprint banned (security definer so anon caller can check pre-signup)
CREATE OR REPLACE FUNCTION public.is_fingerprint_banned(_fp text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_fingerprints WHERE fingerprint = _fp);
$$;
GRANT EXECUTE ON FUNCTION public.is_fingerprint_banned(text) TO anon, authenticated;

-- 4) Register fingerprint for current user
CREATE OR REPLACE FUNCTION public.register_device_fingerprint(_fp text, _ua text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.banned_fingerprints WHERE fingerprint = _fp) THEN
    RETURN false;
  END IF;
  INSERT INTO public.device_fingerprints (fingerprint, user_id, user_agent)
  VALUES (_fp, v_user, _ua)
  ON CONFLICT (fingerprint, user_id)
    DO UPDATE SET last_seen_at = now(), user_agent = EXCLUDED.user_agent;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.register_device_fingerprint(text, text) TO authenticated;

-- 5) When a profile is banned, blacklist all their fingerprints
CREATE OR REPLACE FUNCTION public.ban_user_fingerprints()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.banned_at IS NOT NULL AND (OLD.banned_at IS NULL OR OLD.banned_at <> NEW.banned_at) THEN
    INSERT INTO public.banned_fingerprints (fingerprint, reason, banned_by)
    SELECT DISTINCT df.fingerprint, COALESCE(NEW.banned_reason, 'auto: user banned'), NULL
    FROM public.device_fingerprints df
    WHERE df.user_id = NEW.id
    ON CONFLICT (fingerprint) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ban_user_fps ON public.profiles;
CREATE TRIGGER trg_ban_user_fps
  AFTER UPDATE OF banned_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ban_user_fingerprints();

-- 6) Profile completion score column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completion smallint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.compute_profile_completion(p public.profiles)
RETURNS smallint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s int := 0;
BEGIN
  IF p.display_name IS NOT NULL AND length(trim(p.display_name)) > 0 THEN s := s + 10; END IF;
  IF p.bio IS NOT NULL AND length(trim(p.bio)) >= 20 THEN s := s + 10; END IF;
  IF p.birthdate IS NOT NULL THEN s := s + 5; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 1 THEN s := s + 15; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 3 THEN s := s + 10; END IF;
  IF p.gender IS NOT NULL AND array_length(p.gender,1) > 0 THEN s := s + 5; END IF;
  IF p.orientation IS NOT NULL AND array_length(p.orientation,1) > 0 THEN s := s + 5; END IF;
  IF p.tribes IS NOT NULL AND array_length(p.tribes,1) > 0 THEN s := s + 5; END IF;
  IF p.looking_for IS NOT NULL AND array_length(p.looking_for,1) > 0 THEN s := s + 5; END IF;
  IF p.interests IS NOT NULL AND array_length(p.interests,1) > 0 THEN s := s + 5; END IF;
  IF p.height_cm IS NOT NULL THEN s := s + 3; END IF;
  IF p.weight_kg IS NOT NULL THEN s := s + 3; END IF;
  IF p.body_type IS NOT NULL THEN s := s + 3; END IF;
  IF p.position IS NOT NULL THEN s := s + 3; END IF;
  IF p.hiv_status IS NOT NULL THEN s := s + 3; END IF;
  IF p.verified IS TRUE THEN s := s + 10; END IF;
  RETURN LEAST(s, 100)::smallint;
END $$;

CREATE OR REPLACE FUNCTION public.tg_update_profile_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.profile_completion := public.compute_profile_completion(NEW);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profile_completion ON public.profiles;
CREATE TRIGGER trg_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_profile_completion();

-- Backfill existing rows
UPDATE public.profiles SET profile_completion = public.compute_profile_completion(profiles.*)
WHERE profile_completion = 0;

-- 7) Enhanced discover_profiles: adds profile_completion + mutual interest + photo count
CREATE OR REPLACE FUNCTION public.discover_profiles(
  _viewer uuid,
  _max_km integer DEFAULT 100,
  _min_age integer DEFAULT 18,
  _max_age integer DEFAULT 99,
  _genders text[] DEFAULT NULL,
  _tribes text[] DEFAULT NULL,
  _looking_for text[] DEFAULT NULL,
  _limit integer DEFAULT 30,
  _offset integer DEFAULT 0,
  _looking_now_only boolean DEFAULT false,
  _sort text DEFAULT 'smart',
  _tab text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid, display_name text, birthdate date, photos text[], pronouns text[],
  interests text[], prompts jsonb, distance_m double precision, last_seen timestamptz,
  tribes text[], verified boolean, looking_now_until timestamptz, looking_now_intent text,
  hide_age boolean, hide_distance boolean, hide_online boolean, score double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loc geography;
BEGIN
  IF _viewer IS NULL OR _viewer <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(travel_location, location) INTO v_loc FROM public.profiles WHERE id = _viewer;

  RETURN QUERY
  WITH base AS (
    SELECT p.*,
      CASE WHEN v_loc IS NOT NULL AND p.location IS NOT NULL
           THEN ST_Distance(v_loc, p.location) ELSE NULL END AS dist_m,
      EXTRACT(YEAR FROM age(p.birthdate))::int AS age_years,
      COALESCE(array_length(p.photos,1),0) AS photo_count,
      -- mutual interest: have they tapped/woofed me in last 14 days?
      (EXISTS(SELECT 1 FROM public.taps t  WHERE t.from_user = p.id AND t.to_user = _viewer AND t.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.woofs w WHERE w.from_user = p.id AND w.to_user = _viewer AND w.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.favorites f WHERE f.user_id = p.id AND f.favorite_id = _viewer)
      ) AS mutual_interest
    FROM public.profiles p
    WHERE p.id <> _viewer
      AND p.onboarding_completed = true
      AND p.deleted_at IS NULL
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      AND p.banned_at IS NULL
      AND p.incognito IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = _viewer))
      AND NOT EXISTS (SELECT 1 FROM public.swipes s
        WHERE s.swiper_id = _viewer AND s.swipee_id = p.id)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (dist_m IS NULL OR dist_m <= _max_km * 1000)
      AND (birthdate IS NULL OR (age_years BETWEEN _min_age AND _max_age))
      AND (_genders IS NULL OR gender && _genders)
      AND (_tribes IS NULL OR tribes && _tribes)
      AND (_looking_for IS NULL OR looking_for && _looking_for)
      AND (_looking_now_only = false OR (looking_now_until IS NOT NULL AND looking_now_until > now()))
      AND (
        _tab = 'all'
        OR (_tab = 'online'   AND last_seen IS NOT NULL AND last_seen > now() - interval '15 minutes')
        OR (_tab = 'fresh'    AND created_at > now() - interval '7 days')
        OR (_tab = 'photo'    AND photos IS NOT NULL AND array_length(photos, 1) > 0)
        OR (_tab = 'now'      AND looking_now_until IS NOT NULL AND looking_now_until > now())
        OR (_tab = 'verified' AND verified = true)
      )
  )
  SELECT
    f.id, f.display_name, f.birthdate, f.photos, f.pronouns, f.interests, f.prompts,
    f.dist_m AS distance_m,
    CASE WHEN f.hide_online THEN NULL ELSE f.last_seen END AS last_seen,
    f.tribes, f.verified, f.looking_now_until, f.looking_now_intent,
    f.hide_age, f.hide_distance, f.hide_online,
    (
        CASE WHEN f.looking_now_until IS NOT NULL AND f.looking_now_until > now() THEN 0.40 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '15 minutes' THEN 0.20 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '1 hour'    THEN 0.05 ELSE 0.0 END
      + CASE WHEN f.verified THEN 0.10 ELSE 0.0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 0.30 ELSE 0.0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN greatest(0.0, 0.25 - (f.dist_m/1000.0)/200.0) ELSE 0.0 END
      + CASE WHEN f.mutual_interest THEN 0.35 ELSE 0.0 END
      + (COALESCE(f.profile_completion,0)::double precision / 100.0) * 0.15
      + LEAST(f.photo_count, 6) * 0.02
      - LEAST(coalesce(f.risk_score,0)::double precision / 200.0, 0.5)
    )::double precision AS score
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'distance' THEN f.dist_m END NULLS LAST,
    CASE WHEN _sort = 'fresh'    THEN f.created_at END DESC NULLS LAST,
    CASE WHEN _sort = 'online'   THEN f.last_seen END DESC NULLS LAST,
    CASE WHEN _sort = 'age_asc'  THEN f.age_years END ASC NULLS LAST,
    CASE WHEN _sort = 'age_desc' THEN f.age_years END DESC NULLS LAST,
    CASE WHEN _sort NOT IN ('distance','fresh','online','age_asc','age_desc') THEN
      (CASE WHEN f.looking_now_until IS NOT NULL AND f.looking_now_until > now() THEN 0.40 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '15 minutes' THEN 0.20 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '1 hour'    THEN 0.05 ELSE 0.0 END
      + CASE WHEN f.verified THEN 0.10 ELSE 0.0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 0.30 ELSE 0.0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN greatest(0.0, 0.25 - (f.dist_m/1000.0)/200.0) ELSE 0.0 END
      + CASE WHEN f.mutual_interest THEN 0.35 ELSE 0.0 END
      + (COALESCE(f.profile_completion,0)::double precision / 100.0) * 0.15
      + LEAST(f.photo_count, 6) * 0.02) END DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
END $$;

-- 8) Web Push: extend push_subscriptions for VAPID Web Push
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS p256dh text,
  ADD COLUMN IF NOT EXISTS auth text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fcm';

CREATE UNIQUE INDEX IF NOT EXISTS push_subs_endpoint_uniq
  ON public.push_subscriptions(endpoint) WHERE endpoint IS NOT NULL;
