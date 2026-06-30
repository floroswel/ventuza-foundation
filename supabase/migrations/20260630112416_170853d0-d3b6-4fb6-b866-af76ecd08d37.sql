
-- ============================================================
-- Anti-bot P0: email confirmation gate + discover rate limit
-- ============================================================

-- 1) Account usability gate (auth + email_confirmed + age_verified)
CREATE OR REPLACE FUNCTION public.assert_account_usable()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_age_enforce boolean;
  v_age_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Email confirmation (Supabase Auth column). NULL = not confirmed.
  SELECT email_confirmed_at INTO v_confirmed_at
    FROM auth.users WHERE id = v_uid;
  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  -- Age verification (respect feature_flags.age_verification kill-switch in dev)
  SELECT COALESCE(enabled, true) INTO v_age_enforce
    FROM public.feature_flags WHERE key = 'age_verification';
  IF v_age_enforce IS NULL THEN v_age_enforce := true; END IF;

  IF v_age_enforce THEN
    SELECT age_status::text INTO v_age_status
      FROM public.profiles WHERE id = v_uid;
    IF v_age_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_account_usable() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assert_account_usable() TO authenticated, service_role;

-- Existing assert_age_verified() now delegates so all sites are covered.
CREATE OR REPLACE FUNCTION public.assert_age_verified()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_account_usable();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_age_verified() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assert_age_verified() TO authenticated, service_role;

-- 2) discover_profiles: hard cap + rate limit
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
RETURNS TABLE(
  id uuid, display_name text, birthdate date, photos text[], pronouns text[],
  interests text[], prompts jsonb, distance_m double precision,
  last_seen timestamp with time zone, tribes text[], verified boolean,
  looking_now_until timestamp with time zone, looking_now_intent text,
  hide_age boolean, hide_distance boolean, hide_online boolean, score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loc geography;
  v_calls_last_hour int;
  v_max_per_call constant int := 50;
  v_max_calls_per_hour constant int := 10;  -- 10 * 50 = 500 profiles/h cap
  v_effective_limit int;
BEGIN
  IF _viewer IS NULL OR _viewer <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_account_usable();

  -- Hard cap on page size (anti-scrape)
  v_effective_limit := LEAST(GREATEST(COALESCE(_limit, 30), 1), v_max_per_call);

  -- Per-user hourly cap on number of discover requests
  SELECT count(*) INTO v_calls_last_hour
    FROM public.rate_limit_log
    WHERE user_id = _viewer
      AND action  = 'discover_profiles'
      AND created_at > now() - interval '1 hour';

  IF v_calls_last_hour >= v_max_calls_per_hour THEN
    RAISE EXCEPTION 'discover_rate_limited'
      USING ERRCODE = '53400',
            HINT = 'Too many discover requests this hour. Try again later.';
  END IF;

  INSERT INTO public.rate_limit_log(user_id, action) VALUES (_viewer, 'discover_profiles');

  SELECT COALESCE(travel_location, location) INTO v_loc FROM public.profiles WHERE id = _viewer;

  RETURN QUERY
  WITH base AS (
    SELECT p.*,
      CASE WHEN v_loc IS NOT NULL AND p.location IS NOT NULL
           THEN ST_Distance(v_loc, p.location) ELSE NULL END AS dist_m,
      EXTRACT(YEAR FROM age(p.birthdate))::int AS age_years,
      COALESCE(array_length(p.photos,1),0) AS photo_count,
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
    f.id, f.display_name,
    CASE
      WHEN f.hide_age THEN NULL
      WHEN f.birthdate IS NULL THEN NULL
      ELSE make_date(EXTRACT(YEAR FROM f.birthdate)::int, 1, 1)
    END AS birthdate,
    f.photos, f.pronouns, f.interests, f.prompts,
    public.bucket_distance_m(f.dist_m) AS distance_m,
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
    ) AS score
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'distance' THEN f.dist_m END ASC NULLS LAST,
    CASE WHEN _sort = 'newest'   THEN f.created_at END DESC NULLS LAST,
    score DESC NULLS LAST,
    f.last_seen DESC NULLS LAST
  LIMIT v_effective_limit OFFSET GREATEST(COALESCE(_offset,0),0);
END;
$function$;

-- Index pentru rate limit lookup (idempotent)
CREATE INDEX IF NOT EXISTS rl_user_action_time_idx
  ON public.rate_limit_log (user_id, action, created_at DESC);

-- TTL cleanup helper (manual / future cron) — keep log lean
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_log() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limit_log() TO service_role;
