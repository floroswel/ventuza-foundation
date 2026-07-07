
-- SECURITY DEFINER helper that answers "is user X visible to viewer Y" without exposing profile rows via RLS.
CREATE OR REPLACE FUNCTION public.is_profile_publicly_visible(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _owner
      AND p.deleted_at IS NULL
      AND p.banned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = _viewer)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_publicly_visible(uuid, uuid) TO authenticated;

-- Rewrite the cross-user read policy to use the helper so profiles RLS doesn't short-circuit the EXISTS.
DROP POLICY IF EXISTS profile_photos_cross_user_read ON storage.objects;
CREATE POLICY profile_photos_cross_user_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND public.is_profile_publicly_visible(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- Same fix for profile-media (avatars/cover) — profiles RLS was blocking cross-user reads too.
DROP POLICY IF EXISTS "profile-media scoped read" ON storage.objects;
CREATE POLICY "profile-media scoped read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_profile_publicly_visible(
        ((storage.foldername(name))[1])::uuid,
        auth.uid()
      )
    )
  );

-- Same fix for stories — the previous story SELECT policy relied on public.stories row visibility
-- which is fine, but stories from other users also need the block check to be evaluated via SECURITY DEFINER.
DROP POLICY IF EXISTS stories_read_scoped ON storage.objects;
CREATE POLICY stories_read_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stories s
        WHERE s.media_path = storage.objects.name
          AND s.expires_at > now()
          AND public.is_profile_publicly_visible(s.user_id, auth.uid())
      )
    )
  );
