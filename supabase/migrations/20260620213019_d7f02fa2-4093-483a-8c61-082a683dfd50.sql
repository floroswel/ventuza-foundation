
DROP POLICY IF EXISTS "Recipients mark read" ON public.messages;

CREATE POLICY "Recipients mark read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    is_conversation_participant(conversation_id, auth.uid())
    AND sender_id <> auth.uid()
  )
  WITH CHECK (
    is_conversation_participant(conversation_id, auth.uid())
    AND sender_id <> auth.uid()
  );

-- Lock immutable columns at trigger level
CREATE OR REPLACE FUNCTION public.tg_messages_only_read_at_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_at can be updated on messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_lock_columns ON public.messages;
CREATE TRIGGER messages_lock_columns
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_messages_only_read_at_changes();
