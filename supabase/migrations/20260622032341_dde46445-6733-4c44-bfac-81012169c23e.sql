
-- Replace the previous view (was flagged as SECURITY DEFINER view) with a function.
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  display_name text,
  photos text[],
  verified boolean,
  last_seen timestamptz,
  birthdate date,
  tribes text[],
  pronouns text,
  gender text,
  body_type text,
  height_cm int,
  bio text,
  interests text[],
  travel_city text,
  travel_until timestamptz,
  boost_until timestamptz,
  looking_now_until timestamptz,
  "position" text,
  hide_age boolean,
  hide_online boolean,
  hide_distance boolean,
  incognito boolean,
  profile_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, display_name, photos, verified, last_seen, birthdate, tribes,
    pronouns, gender, body_type, height_cm, bio, interests,
    travel_city, travel_until, boost_until, looking_now_until,
    "position", hide_age, hide_online, hide_distance, incognito,
    profile_slug
  FROM public.profiles
  WHERE id = ANY(_ids)
    AND deleted_at IS NULL
    AND (banned_at IS NULL OR banned_at > now())
    AND (suspended_until IS NULL OR suspended_until < now());
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
