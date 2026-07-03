
-- 1) Coloană nouă pentru a ști când a intrat userul în starea "pending".
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_pending_at timestamptz;

-- 2) start_age_verification setează pending_at.
CREATE OR REPLACE FUNCTION public.start_age_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
    SET age_status='pending',
        age_provider='didit',
        age_pending_at = now()
    WHERE id = auth.uid()
      AND age_status IN ('unverified','failed','expired','pending');
END;
$function$;

-- 3) Config default pentru pragul stale (minute).
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'age_verification_stale',
  jsonb_build_object('stale_pending_minutes', 30),
  'După câte minute o verificare Didit blocată pe pending este resetată automat la unverified.'
)
ON CONFLICT (key) DO NOTHING;

-- 4) Reset single user (folosit și de auto-heal client-side).
CREATE OR REPLACE FUNCTION public.reset_stale_age_verification(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stale_min int;
  affected int;
BEGIN
  -- Doar owner-ul, staff sau service_role pot apela.
  IF _user_id <> auth.uid()
     AND NOT public.is_staff(auth.uid())
     AND current_setting('role', true) <> 'service_role'
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((value->>'stale_pending_minutes')::int, 30)
    INTO stale_min
    FROM public.app_settings
    WHERE key = 'age_verification_stale';
  IF stale_min IS NULL THEN stale_min := 30; END IF;

  UPDATE public.profiles
     SET age_status = 'unverified',
         age_pending_at = NULL
   WHERE id = _user_id
     AND age_status = 'pending'
     AND (age_pending_at IS NULL OR age_pending_at < now() - make_interval(mins => stale_min));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_stale_age_verification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_stale_age_verification(uuid) TO authenticated, service_role;

-- 5) Batch cron: resetează toate profilele blocate.
CREATE OR REPLACE FUNCTION public.reset_stale_age_verifications_batch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stale_min int;
  affected int;
BEGIN
  SELECT COALESCE((value->>'stale_pending_minutes')::int, 30)
    INTO stale_min
    FROM public.app_settings
    WHERE key = 'age_verification_stale';
  IF stale_min IS NULL THEN stale_min := 30; END IF;

  WITH upd AS (
    UPDATE public.profiles
       SET age_status = 'unverified',
           age_pending_at = NULL
     WHERE age_status = 'pending'
       AND (age_pending_at IS NULL OR age_pending_at < now() - make_interval(mins => stale_min))
     RETURNING id
  )
  SELECT count(*) INTO affected FROM upd;

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_stale_age_verifications_batch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_stale_age_verifications_batch() TO service_role;

-- 6) Backfill: pentru profilele deja pending, marchează pending_at cu ultimul age_verifications.created_at, sau now() ca fallback.
UPDATE public.profiles p
   SET age_pending_at = COALESCE(
     (SELECT max(av.created_at) FROM public.age_verifications av WHERE av.user_id = p.id),
     now()
   )
 WHERE p.age_status = 'pending' AND p.age_pending_at IS NULL;

-- 7) Cron la 10 minute.
DO $$
BEGIN
  PERFORM cron.unschedule('reset-stale-age-verifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-stale-age-verifications',
  '*/10 * * * *',
  $cron$ SELECT public.reset_stale_age_verifications_batch(); $cron$
);
