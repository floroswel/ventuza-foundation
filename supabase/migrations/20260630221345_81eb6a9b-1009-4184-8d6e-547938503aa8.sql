
-- 1) Trigger: high risk score crossing threshold
CREATE OR REPLACE FUNCTION public.alert_on_high_risk_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.risk_score IS NOT NULL
     AND NEW.risk_score >= 70
     AND (OLD.risk_score IS NULL OR OLD.risk_score < 70) THEN
    -- de-dup: same user, last 6h
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'risk_score_high'
        AND target_id = NEW.id::text
        AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table, target_id)
      VALUES (
        'risk_score_high',
        CASE WHEN NEW.risk_score >= 90 THEN 'critical'
             WHEN NEW.risk_score >= 80 THEN 'warning'
             ELSE 'info' END,
        format('Risc ridicat: utilizator a atins scor %s', NEW.risk_score),
        format('User %s a depășit pragul (scor anterior: %s).',
               COALESCE(NEW.display_name, NEW.id::text),
               COALESCE(OLD.risk_score::text, 'NULL')),
        'profiles',
        NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_high_risk ON public.profiles;
CREATE TRIGGER trg_alert_high_risk
  AFTER INSERT OR UPDATE OF risk_score ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.alert_on_high_risk_score();


-- 2) Trigger: fingerprint anomaly (same fp on >=3 accounts)
CREATE OR REPLACE FUNCTION public.alert_on_fingerprint_anomaly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM public.device_fingerprints
  WHERE fingerprint = NEW.fingerprint;

  IF v_count >= 3 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'fingerprint_cluster'
        AND target_id = NEW.fingerprint
        AND created_at > now() - interval '12 hours'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table, target_id)
      VALUES (
        'fingerprint_cluster',
        CASE WHEN v_count >= 5 THEN 'critical' ELSE 'warning' END,
        format('Fingerprint folosit de %s conturi', v_count),
        format('Dispozitiv %s detectat pe %s utilizatori distincți. Posibil abuz multi-cont.',
               left(NEW.fingerprint, 12) || '…', v_count),
        'device_fingerprints',
        NEW.fingerprint
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_fp_anomaly ON public.device_fingerprints;
CREATE TRIGGER trg_alert_fp_anomaly
  AFTER INSERT ON public.device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.alert_on_fingerprint_anomaly();


-- 3) Trigger: signup spike (statement-level on profiles INSERT)
CREATE OR REPLACE FUNCTION public.alert_on_signup_spike()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent integer;
  v_avg numeric;
BEGIN
  SELECT COUNT(*) INTO v_recent FROM public.profiles
   WHERE created_at > now() - interval '1 hour';

  -- only check past the noise floor
  IF v_recent < 10 THEN RETURN NULL; END IF;

  SELECT COALESCE(COUNT(*)::numeric / 23, 0) INTO v_avg FROM public.profiles
   WHERE created_at > now() - interval '24 hours'
     AND created_at <= now() - interval '1 hour';

  IF v_recent > GREATEST(v_avg * 3, 10) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'signup_spike' AND created_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.admin_alerts(kind, severity, title, body, target_table)
      VALUES (
        'signup_spike',
        CASE WHEN v_recent > v_avg * 10 THEN 'critical' ELSE 'warning' END,
        format('Vârf de înregistrări: %s conturi noi într-o oră', v_recent),
        format('Media ultimelor 24h: %s/h. Verifică pentru posibil abuz / bot wave.', round(v_avg, 2)),
        'profiles'
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_signup_spike ON public.profiles;
CREATE TRIGGER trg_alert_signup_spike
  AFTER INSERT ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.alert_on_signup_spike();


-- Revoke direct execute from public/anon/authenticated; triggers run as definer
REVOKE ALL ON FUNCTION public.alert_on_high_risk_score()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alert_on_fingerprint_anomaly()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alert_on_signup_spike()          FROM PUBLIC, anon, authenticated;
