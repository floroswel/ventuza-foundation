CREATE OR REPLACE FUNCTION public.discover_profiles(
  max_distance_km integer DEFAULT 100,
  min_age integer DEFAULT 18,
  max_age integer DEFAULT 99,
  looking_for_filter text[] DEFAULT NULL,
  gender_filter text[] DEFAULT NULL,
  orientation_filter text[] DEFAULT NULL,
  order_mode text DEFAULT 'score',
  result_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  display_name text,
  birthdate date,
  gender text[],
  pronouns text[],
  orientation text[],
  looking_for text[],
  interests text[],
  bio text,
  prompts jsonb,
  photos text[],
  last_seen timestamptz,
  distance_m double precision,
  score double precision
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.birthdate, p.gender, p.pronouns, p.orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos, p.last_seen,
         CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN ST_Distance(me.location, p.location) ELSE NULL END AS distance_m,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))), 0) * 0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))), 0) * 0.25
         ) AS score
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND p.birthdate IS NOT NULL
    AND date_part('year', age(p.birthdate))::int BETWEEN min_age AND max_age
    AND (looking_for_filter IS NULL OR p.looking_for && looking_for_filter)
    AND (gender_filter IS NULL OR p.gender && gender_filter)
    AND (orientation_filter IS NULL OR p.orientation && orientation_filter)
    AND (
      me.location IS NULL OR p.location IS NULL OR
      ST_DWithin(me.location, p.location, max_distance_km * 1000)
    )
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = me.id AND s.target_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = me.id AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = me.id))
  ORDER BY
    CASE WHEN order_mode = 'distance' THEN
      COALESCE(ST_Distance(me.location, p.location), 1e12)
    END ASC NULLS LAST,
    CASE WHEN order_mode = 'score' THEN (
      CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
           THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
           ELSE 0 END
      + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))), 0) * 0.15
      + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))), 0) * 0.25
    ) END DESC NULLS LAST
  LIMIT result_limit;
END; $$;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer, integer, integer, text[], text[], text[], text, integer) TO authenticated;