
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.detect_admin_anomalies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer := 0;
  r record;
  v_recent integer;
  v_avg numeric;
BEGIN
  -- 1) Experiment conversion threshold (≥20% conversion, ≥50 exposures)
  FOR r IN
    WITH stats AS (
      SELECT
        ee.experiment_key,
        ee.variant,
        COUNT(*) FILTER (WHERE ee.event = 'exposure') AS exposures,
        COUNT(*) FILTER (WHERE ee.event = 'conversion') AS conversions
      FROM public.experiment_events ee
      JOIN public.experiments e ON e.key = ee.experiment_key AND e.status = 'running'
      WHERE ee.created_at > now() - interval '7 days'
      GROUP BY ee.experiment_key, ee.variant
    )
    SELECT experiment_key, variant, exposures, conversions,
           (conversions::numeric / NULLIF(exposures, 0)) AS rate
    FROM stats
    WHERE exposures >= 50
      AND (conversions::numeric / NULLIF(exposures, 0)) >= 0.20
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'experiment_threshold'
        AND target_id = r.experiment_key || ':' || r.variant
        AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table, target_id)
      VALUES (
        'experiment_threshold', 'info',
        format('Experiment „%s" — varianta %s a atins %s%% conversie',
               r.experiment_key, r.variant, round(r.rate * 100, 1)),
        format('%s conversii din %s expuneri în ultimele 7 zile.', r.conversions, r.exposures),
        'experiments', r.experiment_key || ':' || r.variant
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- 2) Feedback spike (general)
  SELECT COUNT(*) INTO v_recent FROM public.feedback
   WHERE created_at > now() - interval '1 hour';
  SELECT COALESCE(COUNT(*)::numeric / 24, 0) INTO v_avg FROM public.feedback
   WHERE created_at > now() - interval '24 hours' AND created_at <= now() - interval '1 hour';

  IF v_recent >= 5 AND v_recent > GREATEST(v_avg * 3, 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'feedback_spike' AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table)
      VALUES (
        'feedback_spike', 'warning',
        format('Spike feedback: %s în ultima oră', v_recent),
        format('Media ultimelor 24h: %s/h. Verifică inbox-ul.', round(v_avg, 2)),
        'feedback'
      );
      v_created := v_created + 1;
    END IF;
  END IF;

  -- 3) Bug spike (feedback kind = 'bug')
  SELECT COUNT(*) INTO v_recent FROM public.feedback
   WHERE created_at > now() - interval '1 hour' AND kind = 'bug';
  SELECT COALESCE(COUNT(*)::numeric / 24, 0) INTO v_avg FROM public.feedback
   WHERE created_at > now() - interval '24 hours'
     AND created_at <= now() - interval '1 hour'
     AND kind = 'bug';

  IF v_recent >= 3 AND v_recent > GREATEST(v_avg * 3, 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'bug_spike' AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table)
      VALUES (
        'bug_spike', 'critical',
        format('Spike bug-uri: %s raportări într-o oră', v_recent),
        format('Media ultimelor 24h: %s/h. Investighează urgent.', round(v_avg, 2)),
        'feedback'
      );
      v_created := v_created + 1;
    END IF;
  END IF;

  -- 4) Error event spike (experiment_events.event = 'error')
  SELECT COUNT(*) INTO v_recent FROM public.experiment_events
   WHERE created_at > now() - interval '1 hour' AND event = 'error';

  IF v_recent >= 10 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'error_spike' AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table)
      VALUES (
        'error_spike', 'critical',
        format('Spike erori frontend: %s în ultima oră', v_recent),
        'Verifică logs / Web Vitals pentru cauza.',
        'experiment_events'
      );
      v_created := v_created + 1;
    END IF;
  END IF;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_admin_anomalies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_admin_anomalies() TO service_role;

-- Schedule: every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-admin-anomalies') THEN
    PERFORM cron.unschedule('detect-admin-anomalies');
  END IF;
  PERFORM cron.schedule(
    'detect-admin-anomalies',
    '*/15 * * * *',
    $cron$ SELECT public.detect_admin_anomalies(); $cron$
  );
END $$;
