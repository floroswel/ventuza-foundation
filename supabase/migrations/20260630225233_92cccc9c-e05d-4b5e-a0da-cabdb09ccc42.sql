
-- 1) Audit table
CREATE TABLE IF NOT EXISTS public.signup_throttle_logs (
  id bigserial PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('ip_hourly_cap','ip_daily_cap','fp_hourly_cap','fp_daily_cap')),
  ip_hash_prefix text,
  fp_prefix text,
  ip_hour int,
  ip_day int,
  fp_hour int,
  fp_day int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signup_throttle_logs TO authenticated;
GRANT ALL    ON public.signup_throttle_logs TO service_role;

CREATE INDEX IF NOT EXISTS signup_throttle_logs_created_idx
  ON public.signup_throttle_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS signup_throttle_logs_reason_idx
  ON public.signup_throttle_logs (reason, created_at DESC);

ALTER TABLE public.signup_throttle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signup_throttle_logs staff read"
  ON public.signup_throttle_logs FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','auditor']::app_role[]));

-- 2) Rewrite check_signup_throttle to log blocks before raising
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
  v_reason text := NULL;
BEGIN
  IF _ip_hash IS NOT NULL AND length(_ip_hash) > 0 THEN
    SELECT count(*) INTO ip_hour
      FROM public.signup_attempts
      WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
    SELECT count(*) INTO ip_day
      FROM public.signup_attempts
      WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 day';
    IF ip_hour >= 5 THEN
      v_reason := 'ip_hourly_cap';
    ELSIF ip_day >= 20 THEN
      v_reason := 'ip_daily_cap';
    END IF;
  END IF;

  IF v_reason IS NULL AND _fingerprint IS NOT NULL AND length(_fingerprint) > 0 THEN
    SELECT count(*) INTO fp_hour
      FROM public.signup_attempts
      WHERE fingerprint = _fingerprint AND created_at > now() - interval '1 hour';
    SELECT count(*) INTO fp_day
      FROM public.signup_attempts
      WHERE fingerprint = _fingerprint AND created_at > now() - interval '1 day';
    IF fp_hour >= 3 THEN
      v_reason := 'fp_hourly_cap';
    ELSIF fp_day >= 10 THEN
      v_reason := 'fp_daily_cap';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.signup_throttle_logs
      (reason, ip_hash_prefix, fp_prefix, ip_hour, ip_day, fp_hour, fp_day)
    VALUES (
      v_reason,
      CASE WHEN _ip_hash IS NOT NULL AND length(_ip_hash) > 0 THEN left(_ip_hash, 12) END,
      CASE WHEN _fingerprint IS NOT NULL AND length(_fingerprint) > 0 THEN left(_fingerprint, 12) END,
      ip_hour, ip_day, fp_hour, fp_day
    );
    IF v_reason LIKE 'ip_%' THEN
      RAISE EXCEPTION 'signup_throttled_ip' USING ERRCODE = '53400';
    ELSE
      RAISE EXCEPTION 'signup_throttled_fingerprint' USING ERRCODE = '53400';
    END IF;
  END IF;

  INSERT INTO public.signup_attempts (ip_hash, fingerprint)
  VALUES (NULLIF(_ip_hash, ''), NULLIF(_fingerprint, ''));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_signup_throttle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_throttle(text, text) TO service_role;

-- 3) Extend admin_signup_throttle_stats with `blocks_by_reason` from the audit table
CREATE OR REPLACE FUNCTION public.admin_signup_throttle_stats(
  _window_hours int DEFAULT 24
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w int := GREATEST(1, LEAST(COALESCE(_window_hours, 24), 168));
  result jsonb;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','auditor']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH win AS (
    SELECT * FROM public.signup_attempts
    WHERE created_at > now() - make_interval(hours => w)
  ),
  blk AS (
    SELECT * FROM public.signup_throttle_logs
    WHERE created_at > now() - make_interval(hours => w)
  ),
  ip_agg AS (
    SELECT ip_hash,
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int  AS last_day,
      max(created_at) AS last_seen
    FROM win WHERE ip_hash IS NOT NULL GROUP BY ip_hash
  ),
  fp_agg AS (
    SELECT fingerprint,
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int  AS last_day,
      max(created_at) AS last_seen
    FROM win WHERE fingerprint IS NOT NULL GROUP BY fingerprint
  ),
  hourly AS (
    SELECT date_trunc('hour', created_at) AS bucket,
      count(*)::int AS hits,
      count(DISTINCT ip_hash)::int AS unique_ips,
      count(DISTINCT fingerprint)::int AS unique_fps
    FROM win GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'window_hours', w,
    'generated_at', now(),
    'caps', jsonb_build_object('ip_per_hour',5,'ip_per_day',20,'fp_per_hour',3,'fp_per_day',10),
    'totals', jsonb_build_object(
      'attempts', (SELECT count(*) FROM win),
      'unique_ips', (SELECT count(*) FROM ip_agg),
      'unique_fps', (SELECT count(*) FROM fp_agg),
      'blocked_ips', (SELECT count(*) FROM ip_agg WHERE last_hour >= 5 OR last_day >= 20),
      'blocked_fps', (SELECT count(*) FROM fp_agg WHERE last_hour >= 3 OR last_day >= 10),
      'blocks_logged', (SELECT count(*) FROM blk)
    ),
    'blocks_by_reason', COALESCE((
      SELECT jsonb_object_agg(reason, c)
      FROM (SELECT reason, count(*)::int AS c FROM blk GROUP BY reason) r
    ), '{}'::jsonb),
    'recent_blocks', COALESCE((
      SELECT jsonb_agg(row_to_json(b) ORDER BY b.created_at DESC)
      FROM (
        SELECT reason, ip_hash_prefix, fp_prefix, ip_hour, ip_day, fp_hour, fp_day, created_at
        FROM blk ORDER BY created_at DESC LIMIT 50
      ) b
    ), '[]'::jsonb),
    'top_ips', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total DESC)
      FROM (
        SELECT ip_hash, total, last_hour, last_day, last_seen,
          CASE WHEN last_hour >= 5 THEN 'ip_hourly_cap'
               WHEN last_day  >= 20 THEN 'ip_daily_cap' END AS blocked_reason
        FROM ip_agg ORDER BY total DESC LIMIT 50
      ) t
    ), '[]'::jsonb),
    'top_fingerprints', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total DESC)
      FROM (
        SELECT fingerprint, total, last_hour, last_day, last_seen,
          CASE WHEN last_hour >= 3 THEN 'fp_hourly_cap'
               WHEN last_day  >= 10 THEN 'fp_daily_cap' END AS blocked_reason
        FROM fp_agg ORDER BY total DESC LIMIT 50
      ) t
    ), '[]'::jsonb),
    'hourly', COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.bucket) FROM hourly h), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_signup_throttle_stats(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_signup_throttle_stats(int) TO authenticated, service_role;

-- 4) Retention cleanup
CREATE OR REPLACE FUNCTION public.cleanup_signup_throttle_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_throttle_logs WHERE created_at < now() - interval '90 days';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_signup_throttle_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_signup_throttle_logs() TO service_role;
