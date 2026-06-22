-- Block first message from unverified users.
-- An unverified user CAN reply to an existing conversation (where the other party already wrote),
-- but CANNOT initiate / send the first message.
CREATE OR REPLACE FUNCTION public.enforce_verified_first_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_verified boolean;
  has_prior_inbound boolean;
BEGIN
  -- Group messages and self-system inserts are allowed
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(verified, false) INTO is_verified
  FROM public.profiles WHERE id = NEW.sender_id;

  IF is_verified THEN
    RETURN NEW;
  END IF;

  -- Unverified: allow only if there is already a message from the OTHER party in this conversation
  SELECT EXISTS (
    SELECT 1 FROM public.messages
    WHERE conversation_id = NEW.conversation_id
      AND sender_id IS NOT NULL
      AND sender_id <> NEW.sender_id
  ) INTO has_prior_inbound;

  IF NOT has_prior_inbound THEN
    RAISE EXCEPTION 'VERIFICATION_REQUIRED: Trebuie să-ți verifici profilul (selfie) înainte de a trimite primul mesaj.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_verified_first_message ON public.messages;
CREATE TRIGGER trg_enforce_verified_first_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_verified_first_message();

REVOKE EXECUTE ON FUNCTION public.enforce_verified_first_message() FROM anon;