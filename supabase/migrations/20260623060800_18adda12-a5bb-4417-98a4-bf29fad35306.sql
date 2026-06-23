DROP POLICY IF EXISTS ventuza_realtime_authz_select ON realtime.messages;

CREATE POLICY ventuza_realtime_authz_select ON realtime.messages
FOR SELECT TO authenticated
USING (
  ((realtime.topic() LIKE 'notifications:%') AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'matches-%') AND split_part(realtime.topic(), '-', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'conv-list:%') AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'cruise-now:%') AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'discover-profiles:%') AND split_part(realtime.topic(), ':', 2) = (auth.uid())::text)
  OR ((realtime.topic() LIKE 'thread-%') AND public.is_conversation_participant(NULLIF(split_part(realtime.topic(), '-', 2), '')::uuid, auth.uid()))
  OR ((realtime.topic() LIKE 'group:%') AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      AND gm.user_id = auth.uid()
  ))
);