-- Fix: pronouns/gender sunt text[] în public.profiles, nu text.
-- Semnătura greșită provoca 42804 la runtime ("Returned type text[] does not
-- match expected type text in column 8") pe /visitors, chat și grupuri.
-- Schimbarea tipului returnat cere DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid, display_name text, photos text[], verified boolean,
  last_seen timestamptz, birthdate date, tribes text[],
  pronouns text[], gender text[], body_type text, height_cm integer,
  bio text, interests text[], travel_city text, travel_until timestamptz,
  boost_until timestamptz, looking_now_until timestamptz, "position" text,
  hide_age boolean, hide_online boolean, hide_distance boolean,
  incognito boolean, profile_slug text, discreet_avatar text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_calls int;
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
    p.profile_slug, p.discreet_avatar
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
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.list_visible_profiles(uuid[]);

CREATE FUNCTION public.list_visible_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid, display_name text, photos text[], verified boolean,
  last_seen timestamptz, birthdate date, tribes text[],
  pronouns text[], gender text[], body_type text, height_cm integer,
  bio text, interests text[], travel_city text, travel_until timestamptz,
  boost_until timestamptz, looking_now_until timestamptz, "position" text,
  hide_age boolean, hide_online boolean, hide_distance boolean,
  incognito boolean, profile_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_calls int;
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
    p.profile_slug
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_me AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_me)
    )
    AND (
      p.incognito IS NOT TRUE
      OR p.id = v_me
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = v_me AND c.user_b = p.id)
           OR (c.user_b = v_me AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = v_me AND m.user_b = p.id)
           OR (m.user_b = v_me AND m.user_a = p.id)
      )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_profiles(uuid[]) TO authenticated;