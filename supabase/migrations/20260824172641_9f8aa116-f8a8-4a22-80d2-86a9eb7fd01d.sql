CREATE OR REPLACE FUNCTION public.list_visible_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.last_seen END,
    p.birthdate, p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      p.incognito IS NOT TRUE
      OR p.id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = auth.uid() AND c.user_b = p.id)
           OR (c.user_b = auth.uid() AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = auth.uid() AND m.user_b = p.id)
           OR (m.user_b = auth.uid() AND m.user_a = p.id)
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.list_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_profiles(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_local_leaderboard(_radius_km integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, level integer, weekly_xp integer, streak_days integer, rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
          OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
     )
   ORDER BY weekly_xp DESC, p.level DESC
   LIMIT 20;
END;
$function$;