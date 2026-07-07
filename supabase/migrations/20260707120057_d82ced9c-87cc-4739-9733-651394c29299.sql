
CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  recipient uuid;
  sender_name text;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO recipient
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  PERFORM public.notify_user(
    recipient,
    NEW.sender_id,
    'message',
    COALESCE(sender_name, 'Cineva'),
    'Ai un mesaj nou',
    '/messages/' || NEW.conversation_id::text,
    NEW.conversation_id
  );

  PERFORM public.log_notification_dispatch(NEW.sender_id, recipient, 'message', 'db');

  RETURN NEW;
END;
$function$;

UPDATE public.profiles
   SET notification_prefs = COALESCE(notification_prefs, '{}'::jsonb)
                            || '{"show_preview": false}'::jsonb
 WHERE notification_prefs IS NULL
    OR COALESCE((notification_prefs->>'show_preview')::boolean, false) = true;

ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT
    '{"likes": true, "events": true, "matches": true, "messages": true, "marketing": false, "quiet_end": 7, "master_push": true, "quiet_start": 23, "quiet_enabled": false, "show_preview": false}'::jsonb;
