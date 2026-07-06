CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recipient uuid;
  sender_name text;
  preview text;
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

  preview := CASE
    WHEN NEW.media_type = 'image' AND COALESCE(NEW.view_once, false) THEN '📷 Foto o singură vizualizare'
    WHEN NEW.media_type = 'image' THEN '📷 Foto'
    WHEN NEW.media_type = 'audio' THEN '🎤 Mesaj vocal'
    WHEN NEW.media_type = 'location' THEN '📍 Locație partajată'
    ELSE LEFT(COALESCE(NEW.body, ''), 120)
  END;

  PERFORM public.notify_user(
    recipient,
    NEW.sender_id,
    'message',
    COALESCE(sender_name, 'Cineva') || ' ți-a trimis un mesaj',
    preview,
    '/messages/' || NEW.conversation_id::text,
    NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  preview text;
BEGIN
  preview := CASE
    WHEN NEW.media_type = 'image' AND COALESCE(NEW.view_once, false) THEN '📷 Foto o singură vizualizare'
    WHEN NEW.media_type = 'image' THEN '📷 Foto'
    WHEN NEW.media_type = 'audio' THEN '🎤 Mesaj vocal'
    WHEN NEW.media_type = 'location' THEN '📍 Locație partajată'
    ELSE LEFT(COALESCE(NEW.body, ''), 140)
  END;

  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = preview
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;