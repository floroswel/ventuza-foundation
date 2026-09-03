DROP FUNCTION IF EXISTS public.get_profile_by_slug(text);

CREATE FUNCTION public.get_profile_by_slug(_slug text)
RETURNS TABLE(
  id uuid, display_name text, photos text[], verified boolean,
  verified_at timestamp with time zone, birthdate date, tribes text[],
  pronouns text[], gender text[], body_type text, height_cm integer, bio text,
  ideal_match text, interests text[], ask_me_about text[], anthem jsonb,
  prompts jsonb, job_title text, zodiac text, voice_prompt_path text,
  voice_prompt_question text, video_clip_path text, preferred_language text,
  "position" text, hide_age boolean, profile_slug text,
  languages text[], education text, school text, company text,
  children text, pets text[], drinking text, smoking text, cannabis text,
  workout text, diet text, sleep_schedule text, dealbreakers text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _viewer uuid := auth.uid();
  _maybe_uuid uuid;
BEGIN
  PERFORM public.assert_age_verified();

  BEGIN
    _maybe_uuid := _slug::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    _maybe_uuid := NULL;
  END;

  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified, p.verified_at,
    CASE WHEN p.hide_age THEN NULL::date
         ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::integer, 1, 1) END,
    p.tribes, p.pronouns, p.gender, p.body_type, p.height_cm, p.bio,
    p.ideal_match, p.interests, p.ask_me_about, p.anthem, p.prompts,
    p.job_title, p.zodiac, p.voice_prompt_path, p.voice_prompt_question,
    p.video_clip_path, p.preferred_language, p."position", p.hide_age,
    p.profile_slug,
    p.languages, p.education, p.school, p.company, p.children, p.pets,
    p.drinking, p.smoking, p.cannabis, p.workout, p.diet, p.sleep_schedule,
    p.dealbreakers
  FROM public.profiles AS p
  WHERE (p.profile_slug = _slug OR (_maybe_uuid IS NOT NULL AND p.id = _maybe_uuid))
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND (
      p.incognito IS NOT TRUE
      OR p.id = _viewer
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = _viewer AND c.user_b = p.id)
           OR (c.user_b = _viewer AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = _viewer AND m.user_b = p.id)
           OR (m.user_b = _viewer AND m.user_a = p.id)
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks AS b
      WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = _viewer)
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_profile_by_slug(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_by_slug(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "send tap" ON public.taps;
CREATE POLICY "send tap" ON public.taps FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_account_usable()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
         OR (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
    )
  );

DROP POLICY IF EXISTS "woofs_sender_insert" ON public.woofs;
CREATE POLICY "woofs_sender_insert" ON public.woofs FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_account_usable()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
         OR (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
    )
  );

DROP POLICY IF EXISTS "own favorites add" ON public.favorites;
CREATE POLICY "own favorites add" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_account_usable());

DROP POLICY IF EXISTS "Participants create conversations" ON public.conversations;
CREATE POLICY "Participants create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND public.is_account_usable());

DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND public.is_account_usable()
  );

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); a uuid; b uuid; cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_account_usable();
  IF _other IS NULL OR _other = me THEN RAISE EXCEPTION 'invalid recipient'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = me AND b.blocked_id = _other)
       OR (b.blocker_id = _other AND b.blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  IF me < _other THEN a := me; b := _other; ELSE a := _other; b := me; END IF;
  SELECT id INTO cid FROM public.conversations WHERE user_a = a AND user_b = b;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  INSERT INTO public.conversations (user_a, user_b) VALUES (a, b) RETURNING id INTO cid;
  RETURN cid;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_verification_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT p.id
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE p.deleted_at IS NULL
       AND p.banned_at IS NULL
       AND (p.age_status IS DISTINCT FROM 'verified' OR u.email_confirmed_at IS NULL)
       AND p.last_seen > now() - interval '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.push_outbox o
          WHERE o.recipient_id = p.id
            AND o.tag = 'verify-reminder'
            AND o.created_at > now() - interval '20 hours'
       )
     LIMIT 5000
  )
  INSERT INTO public.push_outbox (recipient_id, actor_id, category, title, body, url, tag)
  SELECT c.id, NULL, 'system',
         'Verifica-ti contul',
         'Sunt persoane noi in zona ta. Verifica-ti contul ca sa le vezi si sa poti scrie.',
         '/verify',
         'verify-reminder'
    FROM candidates c;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    PERFORM public.kick_push_dispatch();
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_verification_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_verification_reminders() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verify-reminder-daily') THEN
    PERFORM cron.unschedule('verify-reminder-daily');
  END IF;
END
$do$;

SELECT cron.schedule(
  'verify-reminder-daily',
  '0 17 * * *',
  $$ SELECT public.enqueue_verification_reminders(); $$
);