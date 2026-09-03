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
         'Ai un mesaj nou',
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