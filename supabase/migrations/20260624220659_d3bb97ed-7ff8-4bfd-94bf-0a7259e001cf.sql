
CREATE OR REPLACE FUNCTION public.bucket_distance_m(d double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL THEN NULL
    WHEN d < 1000  THEN 500
    WHEN d < 3000  THEN 2000
    WHEN d < 5000  THEN 4000
    WHEN d < 10000 THEN 8000
    WHEN d < 25000 THEN 20000
    WHEN d < 50000 THEN 40000
    WHEN d < 100000 THEN 80000
    ELSE round(d/10000.0)*10000
  END
$$;

GRANT EXECUTE ON FUNCTION public.bucket_distance_m(double precision) TO anon, authenticated;

-- Overload 1 (_viewer signature)
CREATE OR REPLACE FUNCTION public.discover_profiles(_viewer uuid, _max_km integer DEFAULT 100, _min_age integer DEFAULT 18, _max_age integer DEFAULT 99, _genders text[] DEFAULT NULL::text[], _tribes text[] DEFAULT NULL::text[], _looking_for text[] DEFAULT NULL::text[], _limit integer DEFAULT 30, _offset integer DEFAULT 0, _looking_now_only boolean DEFAULT false, _sort text DEFAULT 'smart'::text, _tab text DEFAULT 'all'::text)
 RETURNS TABLE(id uuid, display_name text, birthdate date, photos text[], pronouns text[], interests text[], prompts jsonb, distance_m double precision, last_seen timestamp with time zone, tribes text[], verified boolean, looking_now_until timestamp with time zone, looking_now_intent text, hide_age boolean, hide_distance boolean, hide_online boolean, score double precision)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END $function$;

-- Overload 2 (legacy max_distance_km signature)
CREATE OR REPLACE FUNCTION public.discover_profiles(max_distance_km integer DEFAULT 100, min_age integer DEFAULT 18, max_age integer DEFAULT 99, looking_for_filter text[] DEFAULT NULL::text[], gender_filter text[] DEFAULT NULL::text[], orientation_filter text[] DEFAULT NULL::text[], tribes_filter text[] DEFAULT NULL::text[], body_filter text[] DEFAULT NULL::text[], position_filter text[] DEFAULT NULL::text[], hiv_filter text[] DEFAULT NULL::text[], min_height integer DEFAULT NULL::integer, max_height integer DEFAULT NULL::integer, online_only boolean DEFAULT false, with_photo_only boolean DEFAULT false, verified_only boolean DEFAULT false, order_mode text DEFAULT 'score'::text, result_limit integer DEFAULT 60, looking_now_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, display_name text, birthdate date, gender text[], pronouns text[], orientation text[], looking_for text[], interests text[], bio text, prompts jsonb, photos text[], last_seen timestamp with time zone, tribes text[], body_type text, height_cm integer, weight_kg integer, ethnicity text, "position" text, hiv_status text, hiv_test_date date, relationship_status text, verified boolean, distance_m double precision, score double precision, boost_until timestamp with time zone, travel_city text, travel_until timestamp with time zone, looking_now_until timestamp with time zone, looking_now_intent text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;
  IF me.suspended_until IS NOT NULL AND me.suspended_until > now() THEN
    RAISE EXCEPTION 'account suspended until %', me.suspended_until;
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name,
         CASE WHEN p.hide_age THEN NULL ELSE p.birthdate END,
         p.gender, p.pronouns, p.orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos,
         CASE WHEN p.hide_online THEN NULL ELSE p.last_seen END,
         p.tribes, p.body_type, p.height_cm, p.weight_kg, p.ethnicity, p."position",
         p.hiv_status, p.hiv_test_date, p.relationship_status,
         (p.verified_at IS NOT NULL),
         CASE WHEN p.hide_distance THEN NULL
              WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN public.bucket_distance_m(ST_Distance(me.location, p.location)) ELSE NULL END,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))),0)*0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))),0)*0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))),0)*0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online THEN 0.20 ELSE 0 END
           + CASE WHEN p.looking_now_until IS NOT NULL AND p.looking_now_until > now() THEN 0.40 ELSE 0 END
           - CASE WHEN p.risk_score >= 50 THEN (p.risk_score::float / 100.0) ELSE 0 END
         ),
         p.boost_until, p.travel_city, p.travel_until,
         p.looking_now_until, p.looking_now_intent
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND COALESCE(p.incognito,false) = false
    AND (p.suspended_until IS NULL OR p.suspended_until <= now())
    AND p.banned_at IS NULL
    AND COALESCE(p.risk_score,0) < 80
    AND p.birthdate IS NOT NULL
    AND date_part('year', age(p.birthdate))::int BETWEEN min_age AND max_age
    AND (looking_for_filter IS NULL OR p.looking_for && looking_for_filter)
    AND (gender_filter IS NULL OR p.gender && gender_filter)
    AND (orientation_filter IS NULL OR p.orientation && orientation_filter)
    AND (tribes_filter IS NULL OR p.tribes && tribes_filter)
    AND (body_filter IS NULL OR p.body_type = ANY(body_filter))
    AND (position_filter IS NULL OR p."position" = ANY(position_filter))
    AND (hiv_filter IS NULL OR p.hiv_status = ANY(hiv_filter))
    AND (min_height IS NULL OR p.height_cm IS NULL OR p.height_cm >= min_height)
    AND (max_height IS NULL OR p.height_cm IS NULL OR p.height_cm <= max_height)
    AND (NOT online_only OR ((now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online))
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND cardinality(p.photos) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND (NOT looking_now_only OR (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()))
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
                      WHERE (b.blocker_id=me.id AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=me.id))
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id=me.id AND s.target_id=p.id)
  ORDER BY
    (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()) DESC,
    CASE WHEN order_mode='distance' AND me.location IS NOT NULL AND p.location IS NOT NULL
         THEN ST_Distance(me.location, p.location) ELSE NULL END NULLS LAST,
    CASE WHEN order_mode='recent' THEN p.last_seen END DESC NULLS LAST,
    (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC,
    score DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(result_limit, 200));
END $function$;
