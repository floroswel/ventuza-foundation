CREATE TABLE IF NOT EXISTS public.push_outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category       text,
  title          text NOT NULL,
  body           text NOT NULL,
  url            text,
  tag            text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','done','dead')),
  attempts       int  NOT NULL DEFAULT 0,
  delivered      int,
  skipped_reason text,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  claimed_at     timestamptz,
  processed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS push_outbox_pending_idx
  ON public.push_outbox (created_at)
  WHERE status IN ('pending','processing');

ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.push_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.claim_push_outbox(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, recipient_id uuid, actor_id uuid, category text,
  title text, body text, url text, tag text, attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
      FROM public.push_outbox o
     WHERE o.status = 'pending'
        OR (o.status = 'processing' AND o.claimed_at < now() - interval '5 minutes')
     ORDER BY o.created_at
     LIMIT GREATEST(1, LEAST(_limit, 500))
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_outbox o
     SET status = 'processing', claimed_at = now()
    FROM picked p
   WHERE o.id = p.id
  RETURNING o.id, o.recipient_id, o.actor_id, o.category,
            o.title, o.body, o.url, o.tag, o.attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_outbox(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_outbox(int) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_push(
  _recipient uuid,
  _actor     uuid,
  _category  text,
  _title     text,
  _body      text,
  _url       text,
  _tag       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _recipient IS NULL OR _recipient = _actor THEN
    RETURN;
  END IF;

  INSERT INTO public.push_outbox (recipient_id, actor_id, category, title, body, url, tag)
  VALUES (_recipient, _actor, _category, _title, _body, _url, _tag);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push(uuid, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_push(uuid, uuid, text, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.kick_push_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT value->>'token' INTO v_token FROM public.app_settings WHERE key = 'cron_internal';
  IF v_token IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://suzeta.app/api/public/cron/push-dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kick_push_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_push_dispatch() TO service_role;

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

  PERFORM public.enqueue_push(
    recipient,
    NEW.sender_id,
    'messages',
    COALESCE(sender_name, 'Mesaj nou'),
    'Ai un mesaj nou',
    '/messages/' || NEW.conversation_id::text,
    'msg:' || NEW.conversation_id::text
  );

  PERFORM public.kick_push_dispatch();

  RETURN NEW;
END;
$function$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-dispatch-drain') THEN
    PERFORM cron.unschedule('push-dispatch-drain');
  END IF;
END
$do$;

SELECT cron.schedule('push-dispatch-drain', '* * * * *', $$ SELECT public.kick_push_dispatch(); $$);

CREATE OR REPLACE FUNCTION public.prune_push_outbox()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.push_outbox
   WHERE (status = 'done' AND processed_at < now() - interval '7 days')
      OR (status = 'dead' AND processed_at < now() - interval '30 days');
$$;

REVOKE ALL ON FUNCTION public.prune_push_outbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_push_outbox() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-outbox-prune') THEN
    PERFORM cron.unschedule('push-outbox-prune');
  END IF;
END
$do$;

SELECT cron.schedule('push-outbox-prune', '17 4 * * *', $$ SELECT public.prune_push_outbox(); $$);