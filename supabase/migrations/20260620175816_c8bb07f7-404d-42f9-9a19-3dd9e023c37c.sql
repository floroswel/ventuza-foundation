
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_location_idx ON public.profiles USING gist (location);

-- swipes
CREATE TABLE public.swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('like','pass','super')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, target_id)
);
GRANT SELECT, INSERT, DELETE ON public.swipes TO authenticated;
GRANT ALL ON public.swipes TO service_role;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own swipes select" ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = swiper_id);
CREATE POLICY "own swipes insert" ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = swiper_id);
CREATE POLICY "own swipes delete" ON public.swipes FOR DELETE TO authenticated USING (auth.uid() = swiper_id);
CREATE INDEX swipes_swiper_idx ON public.swipes(swiper_id);
CREATE INDEX swipes_target_idx ON public.swipes(target_id);

-- matches: store ordered pair (least, greatest) for uniqueness
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants select matches" ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "participants delete matches" ON public.matches FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- blocks
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks select" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "own blocks insert" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "own blocks delete" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- trigger: create match on mutual like
CREATE OR REPLACE FUNCTION public.handle_swipe()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reciprocal boolean;
BEGIN
  IF NEW.action IN ('like','super') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.swipes
      WHERE swiper_id = NEW.target_id AND target_id = NEW.swiper_id AND action IN ('like','super')
    ) INTO reciprocal;
    IF reciprocal THEN
      INSERT INTO public.matches (user_a, user_b)
      VALUES (LEAST(NEW.swiper_id, NEW.target_id), GREATEST(NEW.swiper_id, NEW.target_id))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_swipe() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_swipe_created
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_swipe();

-- update last_seen helper
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen = now() WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- update location helper (accepts lng/lat)
CREATE OR REPLACE FUNCTION public.update_my_location(lng double precision, lat double precision)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      last_seen = now()
  WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.update_my_location(double precision, double precision) TO authenticated;

-- discover RPC
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
  SELECT * INTO me FROM public.profiles WHERE id = auth.uid();
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
