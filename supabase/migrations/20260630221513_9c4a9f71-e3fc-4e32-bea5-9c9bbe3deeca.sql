
CREATE OR REPLACE FUNCTION public.admin_risk_dashboard(_window_hours int DEFAULT 168)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_ok boolean;
  v_now timestamptz := now();
  v_since timestamptz;
  v_dist jsonb;
  v_top jsonb;
  v_flags jsonb;
  v_trend_hourly jsonb;
  v_trend_daily jsonb;
  v_summary jsonb;
  v_kinds jsonb;
BEGIN
  v_role_ok := public.has_role(auth.uid(), 'admin')
            OR public.has_role(auth.uid(), 'super_admin')
            OR public.has_role(auth.uid(), 'moderator')
            OR public.has_role(auth.uid(), 'auditor');
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  _window_hours := GREATEST(1, LEAST(_window_hours, 720)); -- max 30d
  v_since := v_now - make_interval(hours => _window_hours);

  -- 1) Distribution buckets
  SELECT jsonb_agg(jsonb_build_object('bucket', b.label, 'count', b.cnt) ORDER BY b.ord)
    INTO v_dist
  FROM (
    SELECT 1 AS ord, '0-19'  AS label, COUNT(*) FILTER (WHERE risk_score BETWEEN 0  AND 19)::int AS cnt FROM public.profiles
    UNION ALL SELECT 2,'20-39', COUNT(*) FILTER (WHERE risk_score BETWEEN 20 AND 39)::int FROM public.profiles
    UNION ALL SELECT 3,'40-59', COUNT(*) FILTER (WHERE risk_score BETWEEN 40 AND 59)::int FROM public.profiles
    UNION ALL SELECT 4,'60-79', COUNT(*) FILTER (WHERE risk_score BETWEEN 60 AND 79)::int FROM public.profiles
    UNION ALL SELECT 5,'80+',   COUNT(*) FILTER (WHERE risk_score >= 80)::int                  FROM public.profiles
  ) b;

  -- 2) Top 25 users by risk_score (no sensitive cols)
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'risk_score', p.risk_score,
    'created_at', p.created_at,
    'verified', (p.verified_at IS NOT NULL),
    'suspended_until', p.suspended_until,
    'banned_at', p.banned_at,
    'report_count', COALESCE(p.report_count, 0)
  ) ORDER BY p.risk_score DESC, p.created_at DESC)
    INTO v_top
  FROM (
    SELECT id, display_name, risk_score, created_at, verified_at,
           suspended_until, banned_at, report_count
    FROM public.profiles
    WHERE risk_score IS NOT NULL AND risk_score > 0
    ORDER BY risk_score DESC NULLS LAST, created_at DESC
    LIMIT 25
  ) p;

  -- 3) Recent risk_flags
  SELECT jsonb_agg(jsonb_build_object(
    'id', rf.id,
    'user_id', rf.user_id,
    'display_name', pr.display_name,
    'kind', rf.kind,
    'severity', rf.severity,
    'status', rf.status,
    'created_at', rf.created_at,
    'details', rf.details
  ) ORDER BY rf.created_at DESC)
    INTO v_flags
  FROM (
    SELECT id, user_id, kind, severity, status, created_at, details
    FROM public.risk_flags
    WHERE created_at >= v_since
    ORDER BY created_at DESC
    LIMIT 50
  ) rf
  LEFT JOIN public.profiles pr ON pr.id = rf.user_id;

  -- 4) Trend hourly (last 24h) — new flags + distinct high-risk users
  SELECT jsonb_agg(jsonb_build_object(
    'bucket', to_char(h.bucket, 'YYYY-MM-DD"T"HH24:00:00Z'),
    'flags', COALESCE(f.cnt, 0),
    'high_risk_users', COALESCE(hr.cnt, 0)
  ) ORDER BY h.bucket)
    INTO v_trend_hourly
  FROM (
    SELECT generate_series(
      date_trunc('hour', v_now - interval '23 hours'),
      date_trunc('hour', v_now),
      interval '1 hour'
    ) AS bucket
  ) h
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS bucket, COUNT(*)::int AS cnt
    FROM public.risk_flags
    WHERE created_at >= v_now - interval '24 hours'
    GROUP BY 1
  ) f ON f.bucket = h.bucket
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS bucket, COUNT(DISTINCT user_id)::int AS cnt
    FROM public.risk_flags
    WHERE created_at >= v_now - interval '24 hours' AND severity >= 60
    GROUP BY 1
  ) hr ON hr.bucket = h.bucket;

  -- 5) Trend daily (last 30 days)
  SELECT jsonb_agg(jsonb_build_object(
    'bucket', to_char(d.bucket, 'YYYY-MM-DD'),
    'flags', COALESCE(f.cnt, 0),
    'high_risk_users', COALESCE(hr.cnt, 0)
  ) ORDER BY d.bucket)
    INTO v_trend_daily
  FROM (
    SELECT generate_series(
      date_trunc('day', v_now - interval '29 days'),
      date_trunc('day', v_now),
      interval '1 day'
    ) AS bucket
  ) d
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS bucket, COUNT(*)::int AS cnt
    FROM public.risk_flags
    WHERE created_at >= v_now - interval '30 days'
    GROUP BY 1
  ) f ON f.bucket = d.bucket
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS bucket, COUNT(DISTINCT user_id)::int AS cnt
    FROM public.risk_flags
    WHERE created_at >= v_now - interval '30 days' AND severity >= 60
    GROUP BY 1
  ) hr ON hr.bucket = d.bucket;

  -- 6) Kinds breakdown in window
  SELECT jsonb_agg(jsonb_build_object('kind', k.kind, 'count', k.cnt, 'avg_severity', round(k.avg_sev::numeric, 1))
                   ORDER BY k.cnt DESC)
    INTO v_kinds
  FROM (
    SELECT kind, COUNT(*)::int AS cnt, AVG(severity) AS avg_sev
    FROM public.risk_flags
    WHERE created_at >= v_since
    GROUP BY kind
    ORDER BY cnt DESC
    LIMIT 12
  ) k;

  -- 7) Summary
  v_summary := jsonb_build_object(
    'total_profiles', (SELECT COUNT(*) FROM public.profiles),
    'high_risk_count', (SELECT COUNT(*) FROM public.profiles WHERE risk_score >= 60),
    'critical_count', (SELECT COUNT(*) FROM public.profiles WHERE risk_score >= 80),
    'avg_risk', COALESCE((SELECT round(AVG(risk_score)::numeric, 2) FROM public.profiles WHERE risk_score > 0), 0),
    'flags_window', (SELECT COUNT(*) FROM public.risk_flags WHERE created_at >= v_since),
    'flags_open', (SELECT COUNT(*) FROM public.risk_flags WHERE status = 'open'),
    'flags_last_hour', (SELECT COUNT(*) FROM public.risk_flags WHERE created_at >= v_now - interval '1 hour')
  );

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'window_hours', _window_hours,
    'summary', v_summary,
    'distribution', COALESCE(v_dist, '[]'::jsonb),
    'top_users', COALESCE(v_top, '[]'::jsonb),
    'recent_flags', COALESCE(v_flags, '[]'::jsonb),
    'kinds', COALESCE(v_kinds, '[]'::jsonb),
    'trend_hourly', COALESCE(v_trend_hourly, '[]'::jsonb),
    'trend_daily', COALESCE(v_trend_daily, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_risk_dashboard(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_risk_dashboard(int) TO authenticated, service_role;
