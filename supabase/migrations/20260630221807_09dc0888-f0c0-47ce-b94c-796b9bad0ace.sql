
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_attempts_ip_time_idx
  ON public.signup_attempts (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS signup_attempts_fp_time_idx
  ON public.signup_attempts (fingerprint, created_at DESC)
  WHERE fingerprint IS NOT NULL;

GRANT SELECT ON public.signup_attempts TO authenticated;
GRANT ALL ON public.signup_attempts TO service_role;

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signup_attempts staff read"
  ON public.signup_attempts FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'super_admin'::app_role, 'auditor'::app_role]));

-- Anti-bot signup throttle. SECURITY DEFINER so anonymous callers can record
-- attempts via /api/public/signup-guard without table grants. Throws on cap.
CREATE OR REPLACE FUNCTION public.check_signup_throttle(
  _ip_hash text,
  _fingerprint text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ip_hour int := 0;
  ip_day  int := 0;
  fp_hour int := 0;
  fp_day  int := 0;
BEGIN
  IF _ip_hash IS NOT NULL AND length(_ip_hash) > 0 THEN
    SELECT count(*) INTO ip_hour
      FROM public.signup_attempts
      WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
    SELECT count(*) INTO ip_day
      FROM public.signup_attempts
      WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 day';
    IF ip_hour >= 5 OR ip_day >= 20 THEN
      RAISE EXCEPTION 'signup_throttled_ip' USING ERRCODE = '53400';
    END IF;
  END IF;

  IF _fingerprint IS NOT NULL AND length(_fingerprint) > 0 THEN
    SELECT count(*) INTO fp_hour
      FROM public.signup_attempts
      WHERE fingerprint = _fingerprint AND created_at > now() - interval '1 hour';
    SELECT count(*) INTO fp_day
      FROM public.signup_attempts
      WHERE fingerprint = _fingerprint AND created_at > now() - interval '1 day';
    IF fp_hour >= 3 OR fp_day >= 10 THEN
      RAISE EXCEPTION 'signup_throttled_fingerprint' USING ERRCODE = '53400';
    END IF;
  END IF;

  INSERT INTO public.signup_attempts (ip_hash, fingerprint)
  VALUES (NULLIF(_ip_hash, ''), NULLIF(_fingerprint, ''));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_signup_throttle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_throttle(text, text) TO service_role;

-- Janitor: keep table small. Pair with pg_cron if desired.
CREATE OR REPLACE FUNCTION public.cleanup_signup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_attempts WHERE created_at < now() - interval '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_signup_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_signup_attempts() TO service_role;
