
DROP POLICY IF EXISTS chat_media_auth_read ON storage.objects;
DROP POLICY IF EXISTS chat_media_participants_read ON storage.objects;
CREATE POLICY chat_media_participants_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_conversation_participant(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS stories_read_authenticated ON storage.objects;
DROP POLICY IF EXISTS stories_read_scoped ON storage.objects;
CREATE POLICY stories_read_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stories s
        WHERE s.media_path = name
          AND s.expires_at > now()
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS "profile-media authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "profile-media scoped read" ON storage.objects;
CREATE POLICY "profile-media scoped read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
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
    )
  );

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventuza_realtime_authz_select" ON realtime.messages;
CREATE POLICY "ventuza_realtime_authz_select" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (realtime.topic() IN ('cruise-now', 'conv-list'))
    OR (realtime.topic() LIKE 'notifications:%'
        AND split_part(realtime.topic(), ':', 2) = auth.uid()::text)
    OR (realtime.topic() LIKE 'matches-%'
        AND split_part(realtime.topic(), '-', 2) = auth.uid()::text)
    OR (realtime.topic() LIKE 'thread-%'
        AND public.is_conversation_participant(NULLIF(split_part(realtime.topic(), '-', 2), '')::uuid, auth.uid()))
    OR (realtime.topic() LIKE 'group:%'
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            AND gm.user_id = auth.uid()
        ))
  );

DROP POLICY IF EXISTS "ventuza_realtime_authz_insert" ON realtime.messages;
CREATE POLICY "ventuza_realtime_authz_insert" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (realtime.topic() IN ('cruise-now', 'conv-list'))
    OR (realtime.topic() LIKE 'thread-%'
        AND public.is_conversation_participant(NULLIF(split_part(realtime.topic(), '-', 2), '')::uuid, auth.uid()))
    OR (realtime.topic() LIKE 'group:%'
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            AND gm.user_id = auth.uid()
        ))
  );
