
CREATE TYPE public.notification_type AS ENUM (
  'match', 'message', 'profile_view', 'album_request', 'album_granted', 'event_rsvp', 'event_reminder'
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts done by triggers via SECURITY DEFINER; no insert policy for end users.

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Helper to insert notifications (security definer to bypass RLS in triggers)
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id UUID,
  _actor_id UUID,
  _type public.notification_type,
  _title TEXT,
  _body TEXT,
  _link TEXT,
  _entity_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR (_actor_id IS NOT NULL AND _actor_id = _user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications(user_id, actor_id, type, title, body, link, entity_id)
  VALUES (_user_id, _actor_id, _type, _title, _body, _link, _entity_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_user(UUID, UUID, public.notification_type, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user(UUID, UUID, public.notification_type, TEXT, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(UUID, UUID, public.notification_type, TEXT, TEXT, TEXT, UUID) FROM authenticated;

-- ===== TRIGGER: new message =====
CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient UUID;
  sender_name TEXT;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO recipient
  FROM public.conversations c WHERE c.id = NEW.conversation_id;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.notify_user(
    recipient,
    NEW.sender_id,
    'message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.content, ''), 120),
    '/messages/' || NEW.conversation_id::text,
    NEW.conversation_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message ON public.messages;
CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_message();

-- ===== TRIGGER: new match =====
CREATE OR REPLACE FUNCTION public.tg_notify_new_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  name_a TEXT; name_b TEXT;
BEGIN
  SELECT display_name INTO name_a FROM public.profiles WHERE id = NEW.user_a;
  SELECT display_name INTO name_b FROM public.profiles WHERE id = NEW.user_b;

  PERFORM public.notify_user(NEW.user_a, NEW.user_b, 'match',
    'New match!', 'You matched with ' || COALESCE(name_b, 'someone'),
    '/messages', NEW.id);
  PERFORM public.notify_user(NEW.user_b, NEW.user_a, 'match',
    'New match!', 'You matched with ' || COALESCE(name_a, 'someone'),
    '/messages', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_match ON public.matches;
CREATE TRIGGER notify_new_match
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_match();

-- ===== TRIGGER: album request =====
CREATE OR REPLACE FUNCTION public.tg_notify_album_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT display_name INTO requester_name FROM public.profiles WHERE id = NEW.requester_id;
    PERFORM public.notify_user(
      NEW.owner_id, NEW.requester_id, 'album_request',
      'Private album request',
      COALESCE(requester_name, 'Someone') || ' wants to see your private album',
      '/profile', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'granted' AND OLD.status <> 'granted' THEN
    PERFORM public.notify_user(
      NEW.requester_id, NEW.owner_id, 'album_granted',
      'Album unlocked',
      'You can now view their private album',
      '/discover', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_album_request ON public.album_requests;
CREATE TRIGGER notify_album_request
  AFTER INSERT OR UPDATE ON public.album_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_album_request();

-- ===== TRIGGER: event RSVP (notify host) =====
CREATE OR REPLACE FUNCTION public.tg_notify_event_rsvp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host UUID;
  ev_title TEXT;
  user_name TEXT;
BEGIN
  SELECT host_id, title INTO host, ev_title FROM public.events WHERE id = NEW.event_id;
  SELECT display_name INTO user_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_user(
    host, NEW.user_id, 'event_rsvp',
    COALESCE(user_name, 'Someone') || ' is ' || NEW.status,
    'For your event: ' || COALESCE(ev_title, ''),
    '/events/' || NEW.event_id::text, NEW.event_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_event_rsvp ON public.event_rsvps;
CREATE TRIGGER notify_event_rsvp
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_event_rsvp();
