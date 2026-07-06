
-- 1. Tabel de dispatch (Art. 30) — append-only, fără conținut
CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid,
  target_id   uuid NOT NULL,
  kind        text NOT NULL,
  channel     text NOT NULL DEFAULT 'db',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_dispatch_target ON public.notification_dispatch_log(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_dispatch_actor  ON public.notification_dispatch_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_dispatch_kind   ON public.notification_dispatch_log(kind, created_at DESC);

-- 2. GRANTS — scrierea DOAR via SECURITY DEFINER; citirea via helper gated
GRANT SELECT ON public.notification_dispatch_log TO authenticated;
GRANT ALL    ON public.notification_dispatch_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notification_dispatch_log_id_seq TO service_role;

-- 3. RLS: doar auditor/super_admin pot citi; niciun user obișnuit
ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_read_dispatch" ON public.notification_dispatch_log;
CREATE POLICY "audit_read_dispatch"
  ON public.notification_dispatch_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'auditor'::app_role)
  );

-- 4. Append-only: refuz UPDATE / DELETE (chiar și pentru service_role via SQL direct)
CREATE OR REPLACE FUNCTION public.prevent_dispatch_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'notification_dispatch_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_no_update ON public.notification_dispatch_log;
CREATE TRIGGER trg_dispatch_no_update
  BEFORE UPDATE OR DELETE ON public.notification_dispatch_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_dispatch_log_mutation();

-- 5. Helper SECURITY DEFINER pentru scrierea din trigger-e și server fns
CREATE OR REPLACE FUNCTION public.log_notification_dispatch(
  _actor uuid,
  _target uuid,
  _kind text,
  _channel text DEFAULT 'db'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _target IS NULL OR _kind IS NULL THEN RETURN; END IF;
  INSERT INTO public.notification_dispatch_log(actor_id, target_id, kind, channel)
  VALUES (_actor, _target, _kind, COALESCE(_channel, 'db'));
END;
$$;

REVOKE ALL ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text) TO service_role;

-- 6. Re-creez tg_notify_new_message ca să logheze dispatch-ul (fără conținut)
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

  -- GDPR Art. 30: dispatch log, ZERO conținut
  PERFORM public.log_notification_dispatch(NEW.sender_id, recipient, 'message', 'db');

  RETURN NEW;
END;
$function$;

-- 7. Consultare admin — scrie în admin_audit_log fără conținut
CREATE OR REPLACE FUNCTION public.admin_log_notification_access(
  _target_user uuid,
  _count integer,
  _justification text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT public.is_staff(actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admin_audit_log(
    actor_id, action, target_table, target_id,
    after_data, justification, severity
  )
  VALUES (
    actor,
    'notifications.consult',
    'notifications',
    _target_user::text,
    jsonb_build_object('count', COALESCE(_count, 0)),
    NULLIF(_justification, ''),
    'info'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_notification_access(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_notification_access(uuid, integer, text) TO authenticated;
