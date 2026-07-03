
CREATE OR REPLACE FUNCTION public.get_user_badges_batch(_user_ids uuid[])
RETURNS TABLE(user_id uuid, badges text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u AS user_id, public.get_user_badges(u) AS badges
  FROM unnest(_user_ids) AS u;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_badges_batch(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_venue_badges_batch(_venue_ids uuid[])
RETURNS TABLE(venue_id uuid, badges text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v AS venue_id, public.get_venue_badges(v) AS badges
  FROM unnest(_venue_ids) AS v;
$$;

REVOKE ALL ON FUNCTION public.get_venue_badges_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_badges_batch(uuid[]) TO anon, authenticated, service_role;
