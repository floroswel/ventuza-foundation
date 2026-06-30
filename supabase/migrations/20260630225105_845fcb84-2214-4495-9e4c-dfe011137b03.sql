
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
  ip_agg AS (
    SELECT
      ip_hash,
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int  AS last_day,
      max(created_at) AS last_seen
    FROM win
    WHERE ip_hash IS NOT NULL
    GROUP BY ip_hash
  ),
  fp_agg AS (
    SELECT
      fingerprint,
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int  AS last_day,
      max(created_at) AS last_seen
    FROM win
    WHERE fingerprint IS NOT NULL
    GROUP BY fingerprint
  ),
  hourly AS (
    SELECT
      date_trunc('hour', created_at) AS bucket,
      count(*)::int AS hits,
      count(DISTINCT ip_hash)::int AS unique_ips,
      count(DISTINCT fingerprint)::int AS unique_fps
    FROM win
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'window_hours', w,
    'generated_at', now(),
    'caps', jsonb_build_object(
      'ip_per_hour', 5, 'ip_per_day', 20,
      'fp_per_hour', 3, 'fp_per_day', 10
    ),
    'totals', jsonb_build_object(
      'attempts', (SELECT count(*) FROM win),
      'unique_ips', (SELECT count(*) FROM ip_agg),
      'unique_fps', (SELECT count(*) FROM fp_agg),
      'blocked_ips', (SELECT count(*) FROM ip_agg WHERE last_hour >= 5 OR last_day >= 20),
      'blocked_fps', (SELECT count(*) FROM fp_agg WHERE last_hour >= 3 OR last_day >= 10)
    ),
    'top_ips', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total DESC)
      FROM (
        SELECT
          ip_hash,
          total, last_hour, last_day, last_seen,
          CASE
            WHEN last_hour >= 5 THEN 'ip_hourly_cap'
            WHEN last_day  >= 20 THEN 'ip_daily_cap'
            ELSE NULL
          END AS blocked_reason
        FROM ip_agg
        ORDER BY total DESC
        LIMIT 50
      ) t
    ), '[]'::jsonb),
    'top_fingerprints', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total DESC)
      FROM (
        SELECT
          fingerprint,
          total, last_hour, last_day, last_seen,
          CASE
            WHEN last_hour >= 3 THEN 'fp_hourly_cap'
            WHEN last_day  >= 10 THEN 'fp_daily_cap'
            ELSE NULL
          END AS blocked_reason
        FROM fp_agg
        ORDER BY total DESC
        LIMIT 50
      ) t
    ), '[]'::jsonb),
    'hourly', COALESCE((
      SELECT jsonb_agg(row_to_json(h) ORDER BY h.bucket)
      FROM hourly h
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_signup_throttle_stats(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_signup_throttle_stats(int) TO authenticated, service_role;
