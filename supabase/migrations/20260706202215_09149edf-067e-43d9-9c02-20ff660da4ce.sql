
-- message_locations: policies scoped to conversation participants
GRANT SELECT, INSERT, DELETE ON public.message_locations TO authenticated;
GRANT ALL ON public.message_locations TO service_role;

CREATE POLICY "participants_select_message_locations"
ON public.message_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_locations.message_id
      AND public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "sender_insert_message_locations"
ON public.message_locations FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_locations.message_id
      AND m.sender_id = auth.uid()
      AND public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "sender_delete_message_locations"
ON public.message_locations FOR DELETE TO authenticated
USING (sender_id = auth.uid());
