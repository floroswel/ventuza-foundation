CREATE TABLE IF NOT EXISTS public.ops_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_kind text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_alert_log_kind_created_idx
  ON public.ops_alert_log (alert_kind, created_at DESC);

GRANT ALL ON public.ops_alert_log TO service_role;
GRANT SELECT ON public.ops_alert_log TO authenticated;
ALTER TABLE public.ops_alert_log ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ops_alert_log'
      AND policyname = 'ops_alert_log_staff_read'
  ) THEN
    CREATE POLICY ops_alert_log_staff_read ON public.ops_alert_log
      FOR SELECT TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $pol$;

CREATE OR REPLACE FUNCTION public.ops_health_signals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $fn$
DECLARE
  v_pending int := 0;
  v_http_failures int := 0;
  v_http_sample jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.push_outbox') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*)::int FROM public.push_outbox
      WHERE status = 'pending' AND created_at < now() - interval '10 minutes'
    $q$ INTO v_pending;
  END IF;

  IF to_regclass('net._http_response') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*)::int FROM net._http_response r
      WHERE r.created > now() - interval '1 hour'
        AND coalesce(r.status_code, 0) <> 200
    $q$ INTO v_http_failures;

    EXECUTE $q$
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT r.status_code, r.error_msg, r.created
        FROM net._http_response r
        WHERE r.created > now() - interval '1 hour'
          AND coalesce(r.status_code, 0) <> 200
        ORDER BY r.created DESC
        LIMIT 5
      ) x
    $q$ INTO v_http_sample;
  END IF;

  RETURN jsonb_build_object(
    'push_pending_over_10min', v_pending,
    'http_failures_last_hour', v_http_failures,
    'http_failure_sample', v_http_sample
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'push_pending_over_10min', v_pending,
    'http_failures_last_hour', v_http_failures,
    'http_failure_sample', v_http_sample,
    'partial_error', SQLERRM
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.ops_health_signals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_health_signals() TO service_role;

CREATE OR REPLACE FUNCTION public.ops_try_record_alert(_kind text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ops_alert_log
    WHERE alert_kind = _kind AND created_at > now() - interval '24 hours'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.ops_alert_log (alert_kind, details)
  VALUES (_kind, coalesce(_details, '{}'::jsonb));
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.ops_try_record_alert(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_try_record_alert(text, jsonb) TO service_role;

INSERT INTO public.app_settings (key, value, description)
VALUES ('ops_alerts', jsonb_build_object('email', 'support@suzeta.ro'),
        'Destinatarul alertelor operationale (push blocat, apeluri interne respinse, signup-guard degradat)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cron_ops_health_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_token text;
BEGIN
  SELECT value->>'token' INTO v_token FROM public.app_settings WHERE key = 'cron_internal';
  IF v_token IS NULL THEN
    RAISE WARNING '[cron_ops_health_alerts] app_settings.cron_internal lipseste';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://suzeta.app/api/public/cron/ops-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.cron_ops_health_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_ops_health_alerts() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-health-alerts') THEN
      PERFORM cron.unschedule('ops-health-alerts');
    END IF;
    PERFORM cron.schedule('ops-health-alerts', '*/10 * * * *', 'SELECT public.cron_ops_health_alerts();');
  END IF;
END $cron$;