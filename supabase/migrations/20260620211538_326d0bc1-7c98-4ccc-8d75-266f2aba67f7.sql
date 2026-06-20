DROP FUNCTION IF EXISTS public.discover_profiles(integer,integer,integer,text[],text[],text[],text[],text[],text[],text[],integer,integer,boolean,boolean,boolean,text,integer);

CREATE FUNCTION public.discover_profiles(
  max_distance_km integer DEFAULT 100,
  min_age integer DEFAULT 18,
  max_age integer DEFAULT 99,
  looking_for_filter text[] DEFAULT NULL,
  gender_filter text[] DEFAULT NULL,
  orientation_filter text[] DEFAULT NULL,
  tribes_filter text[] DEFAULT NULL,
  body_filter text[] DEFAULT NULL,
  position_filter text[] DEFAULT NULL,
  hiv_filter text[] DEFAULT NULL,
  min_height integer DEFAULT NULL,
  max_height integer DEFAULT NULL,
  online_only boolean DEFAULT false,
  with_photo_only boolean DEFAULT false,
  verified_only boolean DEFAULT false,
  order_mode text DEFAULT 'score',
  result_limit integer DEFAULT 60
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, gender text[], pronouns text[],
  orientation text[], looking_for text[], interests text[], bio text, prompts jsonb,
  photos text[], last_seen timestamptz, tribes text[], body_type text,
  height_cm integer, weight_kg integer, ethnicity text, "position" text,
  hiv_status text, hiv_test_date date, relationship_status text, verified boolean,
  distance_m double precision, score double precision,
  boost_until timestamptz, travel_city text, travel_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.birthdate, p.gender, p.pronouns, p.orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos, p.last_seen,
         p.tribes, p.body_type, p.height_cm, p.weight_kg, p.ethnicity, p."position",
         p.hiv_status, p.hiv_test_date, p.relationship_status,
         (p.verified_at IS NOT NULL) AS verified,
         CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN ST_Distance(me.location, p.location) ELSE NULL END AS distance_m,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))), 0) * 0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))), 0) * 0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))), 0) * 0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' THEN 0.20 ELSE 0 END
         ) AS score,
         p.boost_until, p.travel_city, p.travel_until
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND COALESCE(p.incognito, false) = false
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
    AND (NOT online_only OR (now() - p.last_seen) < interval '5 minutes')
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND cardinality(p.photos) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND (me.location IS NULL OR p.location IS NULL OR ST_DWithin(me.location, p.location, max_distance_km * 1000))
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = me.id AND s.target_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = me.id AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = me.id))
  ORDER BY
    (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC,
    p.boost_until DESC NULLS LAST,
    CASE WHEN order_mode = 'distance' THEN COALESCE(ST_Distance(me.location, p.location), 1e12) END ASC NULLS LAST,
    CASE WHEN order_mode = 'score' THEN (
      CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
           THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
           ELSE 0 END
      + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))), 0) * 0.15
      + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))), 0) * 0.25
      + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))), 0) * 0.30
      + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
      + CASE WHEN (now() - p.last_seen) < interval '5 minutes' THEN 0.20 ELSE 0 END
    ) END DESC NULLS LAST,
    p.last_seen DESC
  LIMIT result_limit;
END;
$function$;