
-- Reply / threading on messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Read receipts opt-out + match auto-share toggle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS read_receipts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_share_album_on_match boolean NOT NULL DEFAULT false;

-- Auto-unlock private album for both users when a match is created (only if owner opted in)
CREATE OR REPLACE FUNCTION public.auto_share_album_on_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_optin boolean;
  b_optin boolean;
BEGIN
  SELECT auto_share_album_on_match INTO a_optin FROM public.profiles WHERE id = NEW.user_a;
  SELECT auto_share_album_on_match INTO b_optin FROM public.profiles WHERE id = NEW.user_b;

  IF a_optin THEN
    INSERT INTO public.album_unlocks (owner_id, viewer_id)
    VALUES (NEW.user_a, NEW.user_b)
    ON CONFLICT DO NOTHING;
  END IF;

  IF b_optin THEN
    INSERT INTO public.album_unlocks (owner_id, viewer_id)
    VALUES (NEW.user_b, NEW.user_a)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_share_album_on_match_trg ON public.matches;
CREATE TRIGGER auto_share_album_on_match_trg
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_share_album_on_match();

-- Unique album_unlocks to support ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS album_unlocks_owner_viewer_uniq
  ON public.album_unlocks(owner_id, viewer_id);

-- Soft-delete (unsend) own message — only within 5 minutes
CREATE OR REPLACE FUNCTION public.unsend_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.messages%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = _message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'message not found'; END IF;
  IF m.sender_id <> auth.uid() THEN RAISE EXCEPTION 'not owner'; END IF;
  IF m.created_at < now() - interval '5 minutes' THEN RAISE EXCEPTION 'too late to unsend'; END IF;
  UPDATE public.messages
     SET deleted_at = now(),
         body = '',
         media_url = NULL,
         media_type = 'text'
   WHERE id = _message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsend_message(uuid) TO authenticated;
