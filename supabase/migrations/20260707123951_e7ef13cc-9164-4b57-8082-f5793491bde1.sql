
-- 1. Parametrii de retenție (configurabili prin app_settings)
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'audit_retention',
  jsonb_build_object(
    'notification_dispatch_log_days', 90,
    'admin_audit_log_days', 180
  ),
  'Retenție (zile) pentru jurnalele append-only. Modificabil prin admin_update_setting.'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Permitem DELETE doar în tranzacția de purge (via GUC de sesiune).
CREATE OR REPLACE FUNCTION public.prevent_dispatch_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'notification_dispatch_log is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

-- 3. Purge notification_dispatch_log
CREATE OR REPLACE FUNCTION public.purge_notification_dispatch_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer;
  deleted integer := 0;
BEGIN
  SELECT COALESCE((value->>'notification_dispatch_log_days')::int, 90)
    INTO days
  FROM public.app_settings
  WHERE key = 'audit_retention';
  IF days IS NULL OR days < 7 THEN days := 90; END IF;

  PERFORM set_config('app.retention_purge', 'on', true);

  WITH d AS (
    DELETE FROM public.notification_dispatch_log
    WHERE created_at < now() - make_interval(days => days)
    RETURNING 1
  )
  SELECT count(*)::int INTO deleted FROM d;

  RETURN COALESCE(deleted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_notification_dispatch_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_notification_dispatch_log() TO service_role;

-- 4. Purge admin_audit_log
CREATE OR REPLACE FUNCTION public.purge_admin_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer;
  deleted integer := 0;
BEGIN
  SELECT COALESCE((value->>'admin_audit_log_days')::int, 180)
    INTO days
  FROM public.app_settings
  WHERE key = 'audit_retention';
  IF days IS NULL OR days < 30 THEN days := 180; END IF;

  PERFORM set_config('app.retention_purge', 'on', true);

  WITH d AS (
    DELETE FROM public.admin_audit_log
    WHERE created_at < now() - make_interval(days => days)
      -- păstrăm întotdeauna acțiunile critice, chiar și peste retenție
      AND COALESCE(severity, 'info') <> 'critical'
    RETURNING 1
  )
  SELECT count(*)::int INTO deleted FROM d;

  RETURN COALESCE(deleted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_admin_audit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_admin_audit_log() TO service_role;

-- 5. Wrapper zilnic care rulează ambele și lasă urmă în admin_audit_log
CREATE OR REPLACE FUNCTION public.run_audit_retention_purge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_dispatch integer := 0;
  n_audit    integer := 0;
BEGIN
  n_dispatch := public.purge_notification_dispatch_log();
  n_audit    := public.purge_admin_audit_log();

  INSERT INTO public.admin_audit_log(
    actor_id, action, target_table, target_id,
    after_data, severity
  )
  VALUES (
    NULL,
    'retention.purge',
    'audit_retention',
    NULL,
    jsonb_build_object(
      'notification_dispatch_log_deleted', n_dispatch,
      'admin_audit_log_deleted', n_audit,
      'ran_at', now()
    ),
    'info'
  );

  RETURN jsonb_build_object(
    'notification_dispatch_log_deleted', n_dispatch,
    'admin_audit_log_deleted', n_audit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_audit_retention_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_audit_retention_purge() TO service_role;

-- 6. Programez rularea zilnic la 03:15 UTC. pg_cron rulează ca superuser →
--    poate executa SECURITY DEFINER-ul fără GRANT anon/authenticated.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-retention-purge-daily') THEN
    PERFORM cron.unschedule('audit-retention-purge-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'audit-retention-purge-daily',
  '15 3 * * *',
  $$ SELECT public.run_audit_retention_purge(); $$
);
