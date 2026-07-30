-- 1. Single source of truth for the messaging age gate
CREATE OR REPLACE FUNCTION public.require_age_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_account_usable();
  RETURN NEW;
END;
$function$;

-- 2. Discover grid shows every eligible user (online or not, swiped or not)
CREATE OR REPLACE FUNCTION public.discover_profiles(_viewer uuid, _max_km integer DEFAULT 100, _min_age integer DEFAULT 18, _max_age integer DEFAULT 99, _genders text[] DEFAULT NULL::text[], _tribes text[] DEFAULT NULL::text[], _looking_for text[] DEFAULT NULL::text[], _limit integer DEFAULT 30, _offset integer DEFAULT 0, _looking_now_only boolean DEFAULT false, _sort text DEFAULT 'smart'::text, _tab text DEFAULT 'all'::text, _orientation text[] DEFAULT NULL::text[], _body text[] DEFAULT NULL::text[], _position text[] DEFAULT NULL::text[], _min_height integer DEFAULT NULL::integer, _max_height integer DEFAULT NULL::integer, _online_only boolean DEFAULT false, _with_photo_only boolean DEFAULT false, _verified_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, display_name text, birthdate date, photos text[], pronouns text[], interests text[], prompts jsonb, distance_m double precision, last_seen timestamp with time zone, tribes text[], verified boolean, looking_now_until timestamp with time zone, looking_now_intent text, hide_age boolean, hide_distance boolean, hide_online boolean, score double precision, gender text[], orientation text[], looking_for text[], bio text, body_type text, height_cm integer, weight_kg integer, ethnicity text, "position" text, relationship_status text, boost_until timestamp with time zone, travel_city text, travel_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loc geography;
  v_calls_last_hour int;
  v_max_per_call constant int := 50;
  v_max_calls_per_hour constant int := 240;
  v_effective_limit int;
BEGIN
  IF _viewer IS NULL OR _viewer <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_account_usable();

  v_effective_limit := LEAST(GREATEST(COALESCE(_limit, 30), 1), v_max_per_call);

  SELECT count(*) INTO v_calls_last_hour
    FROM public.rate_limit_log rll
    WHERE rll.user_id = _viewer
      AND rll.action  = 'discover_profiles'
      AND rll.created_at > now() - interval '1 hour';

  IF v_calls_last_hour >= v_max_calls_per_hour THEN
    RAISE EXCEPTION 'discover_rate_limited'
      USING ERRCODE = '53400',
            HINT = 'Too many discover requests this hour. Try again later.';
  END IF;

  INSERT INTO public.rate_limit_log(user_id, action) VALUES (_viewer, 'discover_profiles');

  SELECT COALESCE(pv.travel_location, pv.location) INTO v_loc
    FROM public.profiles pv WHERE pv.id = _viewer;

  RETURN QUERY
  WITH base AS (
    SELECT p.*,
      CASE WHEN v_loc IS NOT NULL AND p.location IS NOT NULL
           THEN ST_Distance(v_loc, p.location) ELSE NULL END AS dist_m,
      EXTRACT(YEAR FROM age(p.birthdate))::int AS age_years,
      COALESCE(array_length(p.photos,1),0) AS photo_count,
      (EXISTS(SELECT 1 FROM public.taps t  WHERE t.sender_id = p.id AND t.receiver_id = _viewer AND t.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.woofs w WHERE w.sender_id = p.id AND w.receiver_id = _viewer AND w.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.favorites f WHERE f.user_id = p.id AND f.favorite_id = _viewer)
      ) AS mutual_interest
    FROM public.profiles p
    WHERE p.id <> _viewer
      AND p.deleted_at IS NULL
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      AND p.banned_at IS NULL
      AND p.incognito IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = _viewer))
  ),
  filtered AS (
    SELECT * FROM base b
    WHERE (b.dist_m IS NULL OR b.dist_m <= _max_km * 1000)
      AND (b.birthdate IS NULL OR (b.age_years BETWEEN _min_age AND _max_age))
      AND (_genders IS NULL OR b.gender && _genders)
      AND (_tribes IS NULL OR b.tribes && _tribes)
      AND (_looking_for IS NULL OR b.looking_for && _looking_for)
      AND (_orientation IS NULL OR b.orientation && _orientation)
      AND (_body IS NULL OR b.body_type = ANY(_body))
      AND (_position IS NULL OR b."position" = ANY(_position))
      AND (_min_height IS NULL OR b.height_cm IS NULL OR b.height_cm >= _min_height)
      AND (_max_height IS NULL OR b.height_cm IS NULL OR b.height_cm <= _max_height)
      AND (_looking_now_only = false OR (b.looking_now_until IS NOT NULL AND b.looking_now_until > now()))
      AND (_online_only = false OR (b.last_seen IS NOT NULL AND b.last_seen > now() - interval '2 minutes'))
      AND (_with_photo_only = false OR b.photo_count > 0)
      AND (_verified_only = false OR b.verified = true)
      AND (
        _tab <> 'nearby'
        OR (b.dist_m IS NOT NULL AND b.dist_m <= LEAST(_max_km, 25) * 1000)
      )
      AND (
        _tab <> 'fresh'
        OR b.last_seen > now() - interval '48 hours'
      )
  )
  SELECT
    f.id, f.display_name,
    CASE WHEN f.hide_age = true THEN NULL ELSE f.birthdate END AS birthdate,
    f.photos, f.pronouns, f.interests, f.prompts,
    public.bucket_distance_m(f.dist_m) AS distance_m,
    CASE WHEN f.hide_online = true THEN NULL ELSE f.last_seen END AS last_seen,
    f.tribes, f.verified, f.looking_now_until, f.looking_now_intent,
    f.hide_age, f.hide_distance, f.hide_online,
    (
      COALESCE(CASE WHEN f.last_seen > now() - interval '10 minutes' THEN 5 ELSE 0 END, 0)
      + CASE WHEN f.mutual_interest THEN 3 ELSE 0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 10 ELSE 0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN GREATEST(0, 5 - (f.dist_m / 5000)) ELSE 0 END
    )::double precision AS score,
    f.gender, f.orientation, f.looking_for, f.bio,
    f.body_type, f.height_cm, f.weight_kg, f.ethnicity, f."position",
    f.relationship_status, f.boost_until, f.travel_city, f.travel_until
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'distance' THEN f.dist_m END ASC NULLS LAST,
    CASE WHEN _sort = 'recent'   THEN f.last_seen END DESC NULLS LAST,
    CASE WHEN _sort = 'smart'    THEN (
      COALESCE(CASE WHEN f.last_seen > now() - interval '10 minutes' THEN 5 ELSE 0 END, 0)
      + CASE WHEN f.mutual_interest THEN 3 ELSE 0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 10 ELSE 0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN GREATEST(0, 5 - (f.dist_m / 5000)) ELSE 0 END
    ) END DESC NULLS LAST,
    f.last_seen DESC NULLS LAST
  LIMIT v_effective_limit
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
END;
$function$;