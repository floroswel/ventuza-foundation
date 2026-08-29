-- ============================================================
-- Retenție, densitate pe oraș, siguranță și feedback moderare
-- ============================================================

-- 1) WAITLIST PE ORAȘ ----------------------------------------
CREATE TABLE IF NOT EXISTS public.city_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, city)
);

GRANT SELECT, INSERT, DELETE ON public.city_waitlist TO authenticated;
GRANT ALL ON public.city_waitlist TO service_role;

ALTER TABLE public.city_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own waitlist select" ON public.city_waitlist;
CREATE POLICY "own waitlist select" ON public.city_waitlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own waitlist insert" ON public.city_waitlist;
CREATE POLICY "own waitlist insert" ON public.city_waitlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own waitlist delete" ON public.city_waitlist;
CREATE POLICY "own waitlist delete" ON public.city_waitlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS city_waitlist_city_idx ON public.city_waitlist (lower(city));

CREATE OR REPLACE FUNCTION public.join_city_waitlist(_city text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text := btrim(coalesce(_city, ''));
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF length(v_city) < 2 OR length(v_city) > 80 THEN
    RAISE EXCEPTION 'invalid_city' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.city_waitlist(user_id, city)
  VALUES (auth.uid(), v_city)
  ON CONFLICT (user_id, city) DO NOTHING;

  SELECT count(*) INTO v_count
  FROM public.city_waitlist
  WHERE lower(city) = lower(v_city);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.join_city_waitlist(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_city_waitlist(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.city_waitlist_count(_city text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.city_waitlist
  WHERE lower(city) = lower(btrim(coalesce(_city, '')));
$$;

REVOKE ALL ON FUNCTION public.city_waitlist_count(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_waitlist_count(text) TO authenticated, service_role;

-- 2) „CE E NOU AZI" -------------------------------------------
CREATE OR REPLACE FUNCTION public.whats_new_today()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new7 integer;
  v_online integer;
  v_events integer;
BEGIN
  PERFORM public.assert_age_verified();

  SELECT count(*) INTO v_new7
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND p.deleted_at IS NULL
    AND coalesce(p.incognito, false) = false
    AND p.created_at > now() - interval '7 days';

  SELECT count(*) INTO v_online
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND p.deleted_at IS NULL
    AND coalesce(p.incognito, false) = false
    AND p.last_seen > now() - interval '10 minutes';

  SELECT count(*) INTO v_events
  FROM public.events e
  WHERE e.is_published = true
    AND e.moderation_status = 'approved'
    AND e.starts_at BETWEEN now() AND now() + interval '18 hours';

  RETURN jsonb_build_object(
    'new_7d', coalesce(v_new7, 0),
    'online_now', coalesce(v_online, 0),
    'events_tonight', coalesce(v_events, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.whats_new_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whats_new_today() TO authenticated, service_role;

-- 3) NOTIFICĂRI DE REVENIRE (7 / 14 / 30 zile) ----------------
CREATE OR REPLACE FUNCTION public.enqueue_comeback_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_sent integer := 0;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND (p.banned_until IS NULL OR p.banned_until < now())
      AND p.last_seen IS NOT NULL
      AND (
        p.last_seen::date = (now() - interval '7 days')::date
        OR p.last_seen::date = (now() - interval '14 days')::date
        OR p.last_seen::date = (now() - interval '30 days')::date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'admin_message'
          AND n.title = 'Ți-am ținut locul'
          AND n.created_at > now() - interval '6 days'
      )
    LIMIT 500
  LOOP
    PERFORM public.notify_user(
      r.id, NULL, 'admin_message'::notification_type,
      'Ți-am ținut locul',
      'Sunt oameni noi în zona ta. Intră să vezi cine e activ acum.',
      '/discover', NULL
    );
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_comeback_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_comeback_notifications() TO service_role;

-- 4) REMINDER „MATCH FĂRĂ MESAJ" ------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_match_no_message_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_sent integer := 0;
BEGIN
  FOR r IN
    SELECT m.id, m.user_a, m.user_b
    FROM public.matches m
    WHERE m.created_at BETWEEN now() - interval '48 hours' AND now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.messages msg ON msg.conversation_id = c.id
        WHERE ((c.user_a = m.user_a AND c.user_b = m.user_b)
            OR (c.user_a = m.user_b AND c.user_b = m.user_a))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id IN (m.user_a, m.user_b)
          AND n.type = 'admin_message'
          AND n.entity_id = m.id
      )
    LIMIT 500
  LOOP
    PERFORM public.notify_user(
      r.user_a, NULL, 'admin_message'::notification_type,
      'Ai un match fără conversație',
      'V-ați plăcut, dar încă nu ați vorbit. Un „salut" e destul.',
      '/matches', r.id
    );
    PERFORM public.notify_user(
      r.user_b, NULL, 'admin_message'::notification_type,
      'Ai un match fără conversație',
      'V-ați plăcut, dar încă nu ați vorbit. Un „salut" e destul.',
      '/matches', r.id
    );
    v_sent := v_sent + 2;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_match_no_message_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_match_no_message_reminders() TO service_role;

-- 5) SAFETY CHECK-IN ------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_checkins TO authenticated;
GRANT ALL ON public.safety_checkins TO service_role;

ALTER TABLE public.safety_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own safety checkins" ON public.safety_checkins;
CREATE POLICY "own safety checkins" ON public.safety_checkins
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS safety_checkins_due_idx
  ON public.safety_checkins (status, due_at);

CREATE OR REPLACE FUNCTION public.touch_safety_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_safety_checkin ON public.safety_checkins;
CREATE TRIGGER trg_touch_safety_checkin
  BEFORE UPDATE ON public.safety_checkins
  FOR EACH ROW EXECUTE FUNCTION public.touch_safety_checkin();

CREATE OR REPLACE FUNCTION public.create_safety_checkin(_minutes integer, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_min integer := greatest(15, least(coalesce(_minutes, 120), 720));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.safety_checkins
     SET status = 'cancelled'
   WHERE user_id = auth.uid() AND status = 'pending';

  INSERT INTO public.safety_checkins(user_id, note, due_at)
  VALUES (auth.uid(), nullif(btrim(coalesce(_note, '')), ''), now() + make_interval(mins => v_min))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_safety_checkin(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_safety_checkin(integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_safety_checkin(_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.safety_checkins
     SET status = _status,
         confirmed_at = CASE WHEN _status = 'confirmed' THEN now() ELSE confirmed_at END
   WHERE id = _id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_safety_checkin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_safety_checkin(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.escalate_due_safety_checkins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id
    FROM public.safety_checkins
    WHERE status = 'pending' AND due_at < now()
    LIMIT 500
  LOOP
    UPDATE public.safety_checkins
       SET status = 'escalated', escalated_at = now()
     WHERE id = r.id;

    PERFORM public.notify_user(
      r.user_user_id_placeholder_unused_check, NULL, 'admin_message'::notification_type,
      '', '', '', NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- corectat imediat mai jos (versiunea validă)
CREATE OR REPLACE FUNCTION public.escalate_due_safety_checkins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id
    FROM public.safety_checkins
    WHERE status = 'pending' AND due_at < now()
    LIMIT 500
  LOOP
    UPDATE public.safety_checkins
       SET status = 'escalated', escalated_at = now()
     WHERE id = r.id;

    PERFORM public.notify_user(
      r.user_id, NULL, 'admin_message'::notification_type,
      'Verificare de siguranță',
      'Nu ai confirmat că ești bine. Dacă ai nevoie de ajutor: 112. Confirmă din pagina Siguranță.',
      '/safety', r.id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_due_safety_checkins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_due_safety_checkins() TO service_role;

-- 6) FEEDBACK LA RAPORTOR (DSA Art. 16/17) --------------------
CREATE OR REPLACE FUNCTION public.tg_notify_reporter_on_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reporter_id IS NOT NULL
     AND NEW.resolved_at IS NOT NULL
     AND (OLD.resolved_at IS NULL) THEN
    PERFORM public.notify_user(
      NEW.reporter_id, NULL, 'admin_message'::notification_type,
      'Raportarea ta a fost analizată',
      'Echipa a analizat raportarea trimisă de tine și a luat măsurile necesare. Îți mulțumim.',
      '/notifications', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reporter_on_resolution ON public.reports;
CREATE TRIGGER trg_notify_reporter_on_resolution
  AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_reporter_on_resolution();

-- 7) PROGRAMARE AUTOMATĂ --------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('comeback-notifications') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'comeback-notifications');
    PERFORM cron.unschedule('match-no-message-reminders') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'match-no-message-reminders');
    PERFORM cron.unschedule('safety-checkin-escalate') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'safety-checkin-escalate');

    PERFORM cron.schedule('comeback-notifications', '0 17 * * *',
      'SELECT public.enqueue_comeback_notifications();');
    PERFORM cron.schedule('match-no-message-reminders', '30 18 * * *',
      'SELECT public.enqueue_match_no_message_reminders();');
    PERFORM cron.schedule('safety-checkin-escalate', '*/5 * * * *',
      'SELECT public.escalate_due_safety_checkins();');
  END IF;
END;
$$;