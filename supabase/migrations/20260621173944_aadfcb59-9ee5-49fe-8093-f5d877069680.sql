
-- 1. Restrânge politicile realtime: elimină topicurile globale cruise-now / conv-list
DROP POLICY IF EXISTS ventuza_realtime_authz_select ON realtime.messages;
DROP POLICY IF EXISTS ventuza_realtime_authz_insert ON realtime.messages;

CREATE POLICY ventuza_realtime_authz_select ON realtime.messages
FOR SELECT TO authenticated
USING (
  ((realtime.topic() LIKE 'notifications:%') AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'matches-%')        AND split_part(realtime.topic(), '-', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'conv-list:%')      AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'cruise-now:%')     AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'thread-%') AND public.is_conversation_participant(NULLIF(split_part(realtime.topic(), '-', 2), '')::uuid, auth.uid()))
  OR ((realtime.topic() LIKE 'group:%')  AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
          AND gm.user_id = auth.uid()))
);

CREATE POLICY ventuza_realtime_authz_insert ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  ((realtime.topic() LIKE 'thread-%') AND public.is_conversation_participant(NULLIF(split_part(realtime.topic(), '-', 2), '')::uuid, auth.uid()))
  OR ((realtime.topic() LIKE 'group:%')  AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
          AND gm.user_id = auth.uid()))
);

-- 2. Revocă EXECUTE de la anon pe toate funcțiile SECURITY DEFINER din public
-- (trigger functions nu sunt afectate; RPC-urile rămân disponibile pentru authenticated)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 3. Politică citire pentru profile-photos (alte poze profil vizibile pentru autentificați)
DROP POLICY IF EXISTS "profile_photos_cross_user_read" ON storage.objects;
CREATE POLICY "profile_photos_cross_user_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.deleted_at IS NULL
      AND p.banned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
      )
  )
);
