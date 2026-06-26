-- Trebuie DROP + CREATE pentru că RETURNS TABLE se schimbă.
DROP FUNCTION IF EXISTS public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer, boolean
);

CREATE OR REPLACE FUNCTION public.discover_profiles(
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
  result_limit integer DEFAULT 60,
  looking_now_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, gender text[], pronouns text[],
  orientation text[], looking_for text[], interests text[], bio text,
  prompts jsonb, photos text[], last_seen timestamp with time zone,
  tribes text[], body_type text, height_cm integer, weight_kg integer,
  ethnicity text, "position" text, relationship_status text, verified boolean,
  distance_m double precision, score double precision,
  boost_until timestamp with time zone, travel_city text,
  travel_until timestamp with time zone, looking_now_until timestamp with time zone,
  looking_now_intent text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
         p.relationship_status,
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
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND array_length(p.photos,1) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND (NOT looking_now_only OR (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()))
  ORDER BY
    CASE WHEN order_mode = 'distance' THEN
      CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
           THEN ST_Distance(me.location, p.location) ELSE 1e12 END
    END NULLS LAST,
    CASE WHEN order_mode = 'score' THEN
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
      )
    END DESC NULLS LAST,
    p.last_seen DESC NULLS LAST
  LIMIT result_limit;
END $function$;

REVOKE ALL ON FUNCTION public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer, boolean
) TO authenticated;