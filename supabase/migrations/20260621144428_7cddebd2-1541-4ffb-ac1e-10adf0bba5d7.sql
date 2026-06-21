
-- 1. PROFILE EXTRA FIELDS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prep_status text,
  ADD COLUMN IF NOT EXISTS vaccinations text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS meet_at text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS accept_nsfw_photos boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scenes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS expectations text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS safety_practices text[] DEFAULT '{}'::text[];

-- 2. STORIES
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active" ON public.stories FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = stories.user_id)
       OR (b.blocker_id = stories.user_id AND b.blocked_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stories_user_recent ON public.stories(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_recent ON public.stories(expires_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views_owner_select" ON public.story_views;
CREATE POLICY "story_views_owner_select" ON public.story_views FOR SELECT TO authenticated
USING (
  viewer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
);
DROP POLICY IF EXISTS "story_views_insert_self" ON public.story_views;
CREATE POLICY "story_views_insert_self" ON public.story_views FOR INSERT TO authenticated
WITH CHECK (viewer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);

-- 3. GROUP CHATS
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description text CHECK (char_length(coalesce(description,'')) <= 500),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_path text,
  is_public boolean NOT NULL DEFAULT true,
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','mod','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text CHECK (char_length(coalesce(body,'')) <= 2000),
  media_type text NOT NULL DEFAULT 'text' CHECK (media_type IN ('text','image','audio')),
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

DROP POLICY IF EXISTS "groups_select" ON public.groups;
CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated
USING (is_public = true OR public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "groups_insert" ON public.groups;
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
CREATE POLICY "groups_update_owner" ON public.groups FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;
CREATE POLICY "groups_delete_owner" ON public.groups FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT TO authenticated
USING (
  public.is_group_member(group_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.is_public)
);

DROP POLICY IF EXISTS "group_members_join_self" ON public.group_members;
CREATE POLICY "group_members_join_self" ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.is_public)
);

DROP POLICY IF EXISTS "group_members_leave_self" ON public.group_members;
CREATE POLICY "group_members_leave_self" ON public.group_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
CREATE POLICY "group_messages_select" ON public.group_messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_messages_insert_member" ON public.group_messages;
CREATE POLICY "group_messages_insert_member" ON public.group_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_messages_delete_own" ON public.group_messages;
CREATE POLICY "group_messages_delete_own" ON public.group_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);

CREATE OR REPLACE FUNCTION public.group_after_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_group_after_create ON public.groups;
CREATE TRIGGER trg_group_after_create AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.group_after_create();

CREATE OR REPLACE FUNCTION public.group_member_count_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = greatest(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_group_members_count ON public.group_members;
CREATE TRIGGER trg_group_members_count AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.group_member_count_sync();

-- 4. MESSAGES — media types
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'text' CHECK (media_type IN ('text','image','audio','location')),
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_once boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_expires ON public.messages(expires_at);

CREATE OR REPLACE FUNCTION public.mark_message_viewed(_msg_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _conv_id uuid;
BEGIN
  SELECT conversation_id INTO _conv_id FROM public.messages WHERE id = _msg_id;
  IF _conv_id IS NULL THEN RETURN; END IF;
  UPDATE public.messages
     SET viewed_at = COALESCE(viewed_at, now())
   WHERE id = _msg_id AND sender_id <> auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.mark_message_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_viewed(uuid) TO authenticated;

-- 5. DISCOVER tabs & sort
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
      EXTRACT(YEAR FROM age(p.birthdate))::int AS age_years
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
      + CASE WHEN f.verified THEN 0.10 ELSE 0.0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 0.30 ELSE 0.0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN greatest(0.0, 0.25 - (f.dist_m/1000.0)/200.0) ELSE 0.0 END
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
      + CASE WHEN f.verified THEN 0.10 ELSE 0.0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 0.30 ELSE 0.0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN greatest(0.0, 0.25 - (f.dist_m/1000.0)/200.0) ELSE 0.0 END) END DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
END $$;
REVOKE ALL ON FUNCTION public.discover_profiles(uuid,integer,integer,integer,text[],text[],text[],integer,integer,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(uuid,integer,integer,integer,text[],text[],text[],integer,integer,boolean,text,text) TO authenticated;

-- 6. REALTIME
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
