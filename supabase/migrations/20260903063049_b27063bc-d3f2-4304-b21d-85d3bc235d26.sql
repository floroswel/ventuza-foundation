DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text[], gender text[], body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text, discreet_avatar text, distance_bucket_m double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_calls int;
  v_my_loc geography;
BEGIN
  PERFORM public.assert_age_verified();

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RETURN; END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_calls FROM public.rate_limit_log
   WHERE user_id = v_me AND action = 'profile_lookup'
     AND created_at > now() - interval '1 hour';
  IF v_calls >= 300 THEN
    RAISE EXCEPTION 'profile_lookup_rate_limited' USING ERRCODE = '53400';
  END IF;
  INSERT INTO public.rate_limit_log(user_id, action) VALUES (v_me, 'profile_lookup');

  SELECT p.location INTO v_my_loc FROM public.profiles p WHERE p.id = v_me;

  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN (p.incognito IS TRUE OR p.hide_online IS TRUE) AND p.id <> v_me
         THEN NULL ELSE p.last_seen END,
    CASE
      WHEN p.id = v_me THEN p.birthdate
      WHEN p.hide_age IS TRUE THEN NULL
      WHEN p.birthdate IS NULL THEN NULL
      ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::int, 1, 1)
    END,
    p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> v_me THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug, p.discreet_avatar,
    CASE
      WHEN p.id = v_me THEN NULL
      WHEN p.hide_distance IS TRUE OR p.incognito IS TRUE THEN NULL
      WHEN v_my_loc IS NULL OR p.location IS NULL THEN NULL
      ELSE public.bucket_distance_m(ST_Distance(v_my_loc, p.location))
    END
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND (
      p.id = v_me
      OR NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = v_me AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_me)
      )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;

-- Cine m-a adăugat la favorite (RLS pe favorites e owner-only, deci e nevoie de RPC).
CREATE OR REPLACE FUNCTION public.get_favorited_me()
 RETURNS TABLE(user_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid();
BEGIN
  PERFORM public.assert_age_verified();
  IF v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT f.user_id, f.created_at
  FROM public.favorites f
  WHERE f.favorite_id = v_me
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_me AND b.blocked_id = f.user_id)
         OR (b.blocker_id = f.user_id AND b.blocked_id = v_me)
    )
  ORDER BY f.created_at DESC
  LIMIT 200;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_favorited_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_favorited_me() TO authenticated, service_role;