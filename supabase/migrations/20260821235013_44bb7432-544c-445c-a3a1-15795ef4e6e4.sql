
-- 1) Public profile page: hide incognito users from strangers
CREATE OR REPLACE FUNCTION public.get_profile_by_slug(_slug text)
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, verified_at timestamp with time zone, birthdate date, tribes text[], pronouns text[], gender text[], body_type text, height_cm integer, bio text, ideal_match text, interests text[], ask_me_about text[], anthem jsonb, prompts jsonb, job_title text, zodiac text, voice_prompt_path text, voice_prompt_question text, video_clip_path text, preferred_language text, "position" text, hide_age boolean, profile_slug text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _viewer uuid := auth.uid();
  _maybe_uuid uuid;
BEGIN
  PERFORM public.assert_age_verified();

  BEGIN
    _maybe_uuid := _slug::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    _maybe_uuid := NULL;
  END;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.photos,
    p.verified,
    p.verified_at,
    CASE
      WHEN p.hide_age THEN NULL::date
      ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::integer, 1, 1)
    END,
    p.tribes,
    p.pronouns,
    p.gender,
    p.body_type,
    p.height_cm,
    p.bio,
    p.ideal_match,
    p.interests,
    p.ask_me_about,
    p.anthem,
    p.prompts,
    p.job_title,
    p.zodiac,
    p.voice_prompt_path,
    p.voice_prompt_question,
    p.video_clip_path,
    p.preferred_language,
    p."position",
    p.hide_age,
    p.profile_slug
  FROM public.profiles AS p
  WHERE (p.profile_slug = _slug OR (_maybe_uuid IS NOT NULL AND p.id = _maybe_uuid))
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND (
      p.incognito IS NOT TRUE
      OR p.id = _viewer
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = _viewer AND c.user_b = p.id)
           OR (c.user_b = _viewer AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = _viewer AND m.user_b = p.id)
           OR (m.user_b = _viewer AND m.user_a = p.id)
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.blocks AS b
      WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = _viewer)
    );
END;
$fn$;

-- 2) Leaderboard excludes incognito
CREATE OR REPLACE FUNCTION public.get_local_leaderboard(_radius_km integer DEFAULT 50)
RETURNS TABLE(user_id uuid, display_name text, photo_url text, level integer, weekly_xp integer, streak_days integer, rank integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  me_loc geography;
  wk date := public.current_week_start();
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT location INTO me_loc FROM public.profiles WHERE id = auth.uid();
  IF me_loc IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH weekly AS (
    SELECT xe.user_id, SUM(xe.xp)::int AS xp_sum
      FROM public.xp_events xe
     WHERE xe.created_at >= wk
     GROUP BY xe.user_id
  )
  SELECT p.id,
         p.display_name,
         (p.photos->0->>'path')::text AS photo_url,
         p.level,
         COALESCE(w.xp_sum, 0) AS weekly_xp,
         p.streak_days,
         (ROW_NUMBER() OVER (ORDER BY COALESCE(w.xp_sum, 0) DESC, p.level DESC))::int AS rank
    FROM public.profiles p
    LEFT JOIN weekly w ON w.user_id = p.id
   WHERE p.leaderboard_opt_in = true
     AND p.incognito IS NOT TRUE
     AND p.location IS NOT NULL
     AND ST_DWithin(p.location, me_loc, _radius_km * 1000)
     AND p.id <> auth.uid()
   ORDER BY weekly_xp DESC, p.level DESC
   LIMIT 20;
END;
$fn$;

-- 3) Public visibility gate excludes incognito (stories, albums, etc.)
CREATE OR REPLACE FUNCTION public.is_profile_publicly_visible(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _owner
      AND p.deleted_at IS NULL
      AND p.banned_at IS NULL
      AND (p.incognito IS NOT TRUE OR p.id = _viewer)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = _viewer)
      )
  );
$fn$;

-- 4) Hide online status of incognito users
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    id, display_name, photos, verified,
    CASE WHEN incognito IS TRUE AND id <> auth.uid() THEN NULL ELSE last_seen END AS last_seen,
    birthdate, tribes,
    pronouns, gender, body_type, height_cm, bio, interests,
    travel_city, travel_until, boost_until,
    CASE WHEN incognito IS TRUE AND id <> auth.uid() THEN NULL ELSE looking_now_until END AS looking_now_until,
    "position", hide_age, hide_online, hide_distance, incognito,
    profile_slug
  FROM public.profiles
  WHERE id = ANY(_ids)
    AND deleted_at IS NULL
    AND (banned_at IS NULL OR banned_at > now())
    AND (suspended_until IS NULL OR suspended_until < now());
$fn$;

-- 5) Incognito browsing leaves no visitor trace
CREATE OR REPLACE FUNCTION public.skip_profile_view_when_incognito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.viewer_id AND p.incognito IS TRUE) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_skip_profile_view_when_incognito ON public.profile_views;
CREATE TRIGGER trg_skip_profile_view_when_incognito
BEFORE INSERT ON public.profile_views
FOR EACH ROW EXECUTE FUNCTION public.skip_profile_view_when_incognito();

REVOKE ALL ON FUNCTION public.skip_profile_view_when_incognito() FROM PUBLIC, anon, authenticated;
