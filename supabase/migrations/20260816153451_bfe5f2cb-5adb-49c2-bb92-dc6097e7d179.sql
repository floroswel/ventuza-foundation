CREATE OR REPLACE FUNCTION public.get_notification_actors(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photo text, profile_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    CASE WHEN array_length(p.photos, 1) > 0 THEN p.photos[1] ELSE NULL END,
    p.profile_slug
  FROM public.profiles AS p
  WHERE p.id = ANY(_ids)
    AND EXISTS (
      SELECT 1 FROM public.notifications AS n
      WHERE n.user_id = auth.uid() AND n.actor_id = p.id
    )
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks AS b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_notification_actors(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_actors(uuid[]) TO authenticated;