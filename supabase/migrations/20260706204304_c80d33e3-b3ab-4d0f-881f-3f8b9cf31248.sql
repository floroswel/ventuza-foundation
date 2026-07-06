
CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Privacy: nu expunem conținut/tip media în notificare
  PERFORM public.notify_user(
    recipient,
    NEW.sender_id,
    'message',
    COALESCE(sender_name, 'Cineva') || ' ți-a trimis un mesaj',
    'Ai un mesaj nou',
    '/messages/' || NEW.conversation_id::text,
    NEW.conversation_id
  );

  RETURN NEW;
END;
$function$;
