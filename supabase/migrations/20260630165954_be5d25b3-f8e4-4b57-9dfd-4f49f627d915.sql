-- P2 Anti-bot: Admin security signals aggregator
CREATE OR REPLACE FUNCTION public.admin_security_signals(_window_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_window interval := make_interval(hours => GREATEST(1, LEAST(_window_hours, 168)));
  v_signups_total int;
  v_signups_last_hour int;
  v_signups_prev_hour int;
  v_reports_last_hour int;
  v_reports_prev_hour int;
  v_high_risk_count int;
  v_high_risk jsonb;
  v_dup_fp jsonb;
  v_recent_accounts jsonb;
  v_signups_hourly jsonb;
  v_alerts jsonb := '[]'::jsonb;
  v_avg_signup numeric;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Signup totals (profiles.created_at as proxy)
  SELECT count(*) INTO v_signups_total FROM public.profiles WHERE created_at > now() - v_window;
  SELECT count(*) INTO v_signups_last_hour FROM public.profiles WHERE created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_signups_prev_hour FROM public.profiles WHERE created_at > now() - interval '2 hours' AND created_at <= now() - interval '1 hour';

  -- Hourly signup buckets
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'count', c) ORDER BY b), '[]'::jsonb)
    INTO v_signups_hourly
  FROM (
    SELECT date_trunc('hour', created_at) AS b, count(*) AS c
    FROM public.profiles
    WHERE created_at > now() - v_window
    GROUP BY 1
  ) h;

  -- Reports last/prev hour (spike detection)
  SELECT count(*) INTO v_reports_last_hour FROM public.reports WHERE created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_reports_prev_hour FROM public.reports WHERE created_at > now() - interval '2 hours' AND created_at <= now() - interval '1 hour';

  -- High risk users (risk_score >= 60)
  SELECT count(*) INTO v_high_risk_count FROM public.profiles WHERE risk_score >= 60;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', id,
    'display_name', display_name,
    'risk_score', risk_score,
    'created_at', created_at,
    'banned_at', banned_at
  ) ORDER BY risk_score DESC, created_at DESC), '[]'::jsonb)
    INTO v_high_risk
  FROM (
    SELECT id, display_name, risk_score, created_at, banned_at
    FROM public.profiles
    WHERE risk_score >= 60
    ORDER BY risk_score DESC, created_at DESC
    LIMIT 25
  ) hr;

  -- Duplicate fingerprints (same fingerprint -> multiple users)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'fingerprint', fingerprint_short,
    'user_count', user_count,
    'last_seen', last_seen
  ) ORDER BY user_count DESC, last_seen DESC), '[]'::jsonb)
    INTO v_dup_fp
  FROM (
    SELECT substr(fingerprint, 1, 12) || '…' AS fingerprint_short,
           count(DISTINCT user_id) AS user_count,
           max(created_at) AS last_seen
    FROM public.device_fingerprints
    WHERE fingerprint IS NOT NULL AND user_id IS NOT NULL
    GROUP BY fingerprint
    HAVING count(DISTINCT user_id) > 1
    ORDER BY user_count DESC, last_seen DESC
    LIMIT 25
  ) df;

  -- Recent accounts (last window)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', id,
    'display_name', display_name,
    'risk_score', risk_score,
    'created_at', created_at,
    'age_status', age_status
  ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_recent_accounts
  FROM (
    SELECT id, display_name, risk_score, created_at, age_status
    FROM public.profiles
    WHERE created_at > now() - v_window
    ORDER BY created_at DESC
    LIMIT 50
  ) ra;

  -- Avg signups/hour over window for spike comparison
  v_avg_signup := COALESCE(v_signups_total::numeric / GREATEST(EXTRACT(EPOCH FROM v_window)/3600, 1), 0);

  -- Alerts
  IF v_signups_last_hour >= 20 AND v_signups_last_hour > GREATEST(v_avg_signup * 3, v_signups_prev_hour * 3) THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'signup_spike',
      'severity', 'high',
      'message', 'Spike de înregistrări: ' || v_signups_last_hour || ' conturi în ultima oră (medie: ' || round(v_avg_signup,1) || '/h).'
    );
  END IF;

  IF v_reports_last_hour >= 10 AND v_reports_last_hour > v_reports_prev_hour * 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'reports_spike',
      'severity', 'high',
      'message', 'Spike de rapoarte: ' || v_reports_last_hour || ' rapoarte în ultima oră.'
    );
  END IF;

  IF jsonb_array_length(v_dup_fp) >= 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'duplicate_fingerprints',
      'severity', 'medium',
      'message', jsonb_array_length(v_dup_fp) || ' fingerprint-uri folosite de conturi multiple.'
    );
  END IF;

  IF v_high_risk_count >= 5 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'high_risk_users',
      'severity', CASE WHEN v_high_risk_count >= 20 THEN 'high' ELSE 'medium' END,
      'message', v_high_risk_count || ' utilizatori cu risc ridicat (≥60) în sistem.'
    );
  END IF;

  RETURN jsonb_build_object(
    'window_hours', _window_hours,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'signups_total', v_signups_total,
      'signups_last_hour', v_signups_last_hour,
      'signups_prev_hour', v_signups_prev_hour,
      'signups_avg_per_hour', round(v_avg_signup, 2),
      'reports_last_hour', v_reports_last_hour,
      'reports_prev_hour', v_reports_prev_hour,
      'high_risk_count', v_high_risk_count,
      'duplicate_fingerprint_count', jsonb_array_length(v_dup_fp)
    ),
    'alerts', v_alerts,
    'signups_hourly', v_signups_hourly,
    'high_risk_users', v_high_risk,
    'duplicate_fingerprints', v_dup_fp,
    'recent_accounts', v_recent_accounts
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_security_signals(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_signals(integer) TO authenticated, service_role;