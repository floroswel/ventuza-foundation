
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tribes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg integer,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS "position" text,
  ADD COLUMN IF NOT EXISTS hiv_status text,
  ADD COLUMN IF NOT EXISTS hiv_test_date date,
  ADD COLUMN IF NOT EXISTS relationship_status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS incognito boolean NOT NULL DEFAULT false;

-- album_unlocks FIRST
CREATE TABLE IF NOT EXISTS public.album_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, viewer_id)
);
GRANT SELECT, INSERT, DELETE ON public.album_unlocks TO authenticated;
GRANT ALL ON public.album_unlocks TO service_role;
ALTER TABLE public.album_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or viewer can see unlocks"
  ON public.album_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = viewer_id);
CREATE POLICY "owner grants unlocks"
  ON public.album_unlocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner revokes unlocks"
  ON public.album_unlocks FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.private_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_albums TO authenticated;
GRANT ALL ON public.private_albums TO service_role;
ALTER TABLE public.private_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own album"
  ON public.private_albums FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "viewer can see album metadata when unlocked"
  ON public.private_albums FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.album_unlocks au WHERE au.owner_id = private_albums.owner_id AND au.viewer_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.album_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, requester_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.album_requests TO authenticated;
GRANT ALL ON public.album_requests TO service_role;
ALTER TABLE public.album_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "both parties can see album requests"
  ON public.album_requests FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = requester_id);
CREATE POLICY "requester creates request"
  ON public.album_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "owner updates request"
  ON public.album_requests FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner or requester deletes request"
  ON public.album_requests FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = requester_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter sees own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
CREATE POLICY "any user can report"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_views_viewed_idx ON public.profile_views (viewed_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS profile_views_viewer_idx ON public.profile_views (viewer_id, viewed_at DESC);
GRANT SELECT, INSERT ON public.profile_views TO authenticated;
GRANT ALL ON public.profile_views TO service_role;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewer or viewed sees views"
  ON public.profile_views FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id OR auth.uid() = viewed_id);
CREATE POLICY "viewer logs view"
  ON public.profile_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "owner manages private photos" ON storage.objects;
DROP POLICY IF EXISTS "unlocked viewer reads private photos" ON storage.objects;
CREATE POLICY "owner manages private photos"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'private-photos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'private-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "unlocked viewer reads private photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-photos'
    AND EXISTS (SELECT 1 FROM public.album_unlocks au
                WHERE au.owner_id::text = (storage.foldername(name))[1]
                  AND au.viewer_id = auth.uid())
  );

DROP FUNCTION IF EXISTS public.discover_profiles(integer, integer, integer, text[], text[], text[], text, integer);

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
  result_limit integer DEFAULT 60
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, gender text[], pronouns text[],
  orientation text[], looking_for text[], interests text[], bio text, prompts jsonb,
  photos text[], last_seen timestamptz,
  tribes text[], body_type text, height_cm integer, weight_kg integer,
  ethnicity text, "position" text, hiv_status text, hiv_test_date date,
  relationship_status text, verified boolean,
  distance_m double precision, score double precision
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
         ) AS score
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
    ) END DESC NULLS LAST
  LIMIT result_limit;
END; $$;

GRANT EXECUTE ON FUNCTION public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer
) TO authenticated;
