CREATE POLICY "Senders update own live location messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  AND media_type = 'location'
  AND public.is_conversation_participant(conversation_id, auth.uid())
)
WITH CHECK (
  sender_id = auth.uid()
  AND media_type = 'location'
  AND public.is_conversation_participant(conversation_id, auth.uid())
);