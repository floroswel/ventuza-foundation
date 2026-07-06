
-- 1. Default include show_preview=false
ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT '{"likes": true, "events": true, "matches": true, "messages": true, "marketing": false, "quiet_end": 7, "master_push": true, "quiet_start": 23, "quiet_enabled": false, "show_preview": false}'::jsonb;

-- 2. Backfill: adaugă cheia unde lipsește
UPDATE public.profiles
   SET notification_prefs = notification_prefs || '{"show_preview": false}'::jsonb
 WHERE notification_prefs IS NULL OR NOT (notification_prefs ? 'show_preview');

-- 3. Trigger respectă pref-ul destinatarului
CREATE OR REPLACE FUNCTION public.tg_notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  SELECT display_name,
         COALESCE((notification_prefs->>'show_preview')::boolean, false)
    INTO sender_name, show_preview
  FROM public.profiles
  WHERE id = recipient;

  -- Corect: sender_name e al expeditorului, nu al destinatarului
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

  RETURN NEW;
END;
$function$;
