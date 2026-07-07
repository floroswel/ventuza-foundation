
ALTER TABLE public.notification_dispatch_log
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS event_id   uuid;

COMMENT ON COLUMN public.notification_dispatch_log.message_id IS
  'ID mesaj original (public.messages.id) pentru corelare audit. Fără FK; NU conține conținut.';
COMMENT ON COLUMN public.notification_dispatch_log.event_id IS
  'ID eveniment notificare pentru corelare. Fără FK; append-only.';

CREATE INDEX IF NOT EXISTS idx_notif_dispatch_message ON public.notification_dispatch_log(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_dispatch_event   ON public.notification_dispatch_log(event_id)   WHERE event_id   IS NOT NULL;

-- Drop vechea semnătură (are DEFAULT pe _channel; nu poate fi rescris in-place)
DROP FUNCTION IF EXISTS public.log_notification_dispatch(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.log_notification_dispatch(
  _actor uuid,
  _target uuid,
  _kind text,
  _channel text DEFAULT 'db',
  _message_id uuid DEFAULT NULL,
  _event_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _target IS NULL OR _kind IS NULL THEN RETURN; END IF;
  INSERT INTO public.notification_dispatch_log(actor_id, target_id, kind, channel, message_id, event_id)
  VALUES (_actor, _target, _kind, COALESCE(_channel, 'db'), _message_id, _event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  recipient uuid;
  sender_name text;
  show_preview boolean;
  body_out text;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO recipient
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((notification_prefs->>'show_preview')::boolean, false)
    INTO show_preview
  FROM public.profiles
  WHERE id = recipient;

  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF show_preview THEN
    body_out := CASE
      WHEN NEW.media_type = 'image' AND COALESCE(NEW.view_once, false) THEN '📷 Foto o singură vizualizare'
      WHEN NEW.media_type = 'image' THEN '📷 Foto'
      WHEN NEW.media_type = 'audio' THEN '🎤 Mesaj vocal'
      WHEN NEW.media_type = 'location' THEN '📍 Locație partajată'
      ELSE LEFT(COALESCE(NEW.body, ''), 120)
    END;
  ELSE
    body_out := 'Ai un mesaj nou';
  END IF;

  PERFORM public.notify_user(
    recipient,
    NEW.sender_id,
    'message',
    COALESCE(sender_name, 'Cineva') || ' ți-a trimis un mesaj',
    body_out,
    '/messages/' || NEW.conversation_id::text,
    NEW.conversation_id
  );

  PERFORM public.log_notification_dispatch(
    NEW.sender_id, recipient, 'message', 'db', NEW.id, NULL::uuid
  );

  RETURN NEW;
END;
$function$;
