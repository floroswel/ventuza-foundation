ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discreet_avatar text;

DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text, discreet_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, display_name, photos, verified,
    CASE WHEN incognito IS TRUE AND id <> auth.uid() THEN NULL ELSE last_seen END AS last_seen,
    birthdate, tribes,
    pronouns, gender, body_type, height_cm, bio, interests,
    travel_city, travel_until, boost_until,
    CASE WHEN incognito IS TRUE AND id <> auth.uid() THEN NULL ELSE looking_now_until END AS looking_now_until,
    "position", hide_age, hide_online, hide_distance, incognito,
    profile_slug, discreet_avatar
  FROM public.profiles
  WHERE id = ANY(_ids)
    AND deleted_at IS NULL
    AND (banned_at IS NULL OR banned_at > now())
    AND (suspended_until IS NULL OR suspended_until < now());
$function$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;