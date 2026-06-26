
-- Extensii necesare
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Politică explicită pentru self-insert în consent_log (lipsea WITH CHECK)
DROP POLICY IF EXISTS "User logs own consent" ON public.consent_log;
CREATE POLICY "User logs own consent"
  ON public.consent_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2) Politică self-read deletion_requests
DROP POLICY IF EXISTS "Users see own deletion requests" ON public.deletion_requests;
CREATE POLICY "Users see own deletion requests"
  ON public.deletion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users create own deletion request" ON public.deletion_requests;
CREATE POLICY "Users create own deletion request"
  ON public.deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3) Funcție: marchează conturile inactive 24+ luni pentru ștergere
CREATE OR REPLACE FUNCTION public.mark_inactive_for_deletion()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND COALESCE(p.last_seen, p.updated_at, p.created_at) < (now() - interval '24 months')
      AND NOT EXISTS (
        SELECT 1 FROM public.deletion_requests d
        WHERE d.user_id = p.id AND d.status IN ('pending','processed')
      )
  ),
  ins AS (
    INSERT INTO public.deletion_requests (user_id, requested_at, scheduled_for, reason, status)
    SELECT id, now(), now() + interval '30 days', 'auto:inactive_24m', 'pending'
    FROM candidates
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END $$;

REVOKE ALL ON FUNCTION public.mark_inactive_for_deletion() FROM public;

-- 4) Funcție: șterge efectiv conturile la termen
CREATE OR REPLACE FUNCTION public.purge_scheduled_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id FROM public.deletion_requests
    WHERE status = 'pending' AND scheduled_for <= now()
    LIMIT 200
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = r.user_id;
      UPDATE public.deletion_requests
        SET status = 'processed', processed_at = now()
        WHERE id = r.id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.deletion_requests
        SET status = 'failed', processed_at = now(), reason = COALESCE(reason,'') || ' | ' || SQLERRM
        WHERE id = r.id;
    END;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.purge_scheduled_deletions() FROM public;

-- 5) Programări cron
DO $$
BEGIN
  PERFORM cron.unschedule('mark-inactive-for-deletion');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('purge-scheduled-deletions');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'mark-inactive-for-deletion',
  '15 3 * * *',
  $$ SELECT public.mark_inactive_for_deletion(); $$
);

SELECT cron.schedule(
  'purge-scheduled-deletions',
  '30 3 * * *',
  $$ SELECT public.purge_scheduled_deletions(); $$
);
