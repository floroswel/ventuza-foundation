
-- 1) Trigger function: auto-flag new accounts with high risk
CREATE OR REPLACE FUNCTION public.auto_flag_new_high_risk_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_age interval;
  v_threshold int := 60;
  v_new_window interval := interval '7 days';
BEGIN
  IF NEW.risk_score IS NULL OR NEW.risk_score < v_threshold THEN
    RETURN NEW;
  END IF;
  -- Only first crossing of threshold
  IF TG_OP = 'UPDATE' AND OLD.risk_score IS NOT NULL AND OLD.risk_score >= v_threshold THEN
    RETURN NEW;
  END IF;
  -- Account must be "new"
  v_account_age := now() - COALESCE(NEW.created_at, now());
  IF v_account_age > v_new_window THEN
    RETURN NEW;
  END IF;
  -- De-dup: skip if there's already an open queue entry
  IF EXISTS (
    SELECT 1 FROM public.risk_flags
    WHERE user_id = NEW.id
      AND kind = 'new_account_high_risk'
      AND status = 'open'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.risk_flags(user_id, kind, severity, details, status)
  VALUES (
    NEW.id,
    'new_account_high_risk',
    CASE WHEN NEW.risk_score >= 90 THEN 3
         WHEN NEW.risk_score >= 80 THEN 2
         ELSE 1 END,
    jsonb_build_object(
      'risk_score', NEW.risk_score,
      'signals', COALESCE(NEW.risk_signals, '{}'::jsonb),
      'account_age_hours', EXTRACT(EPOCH FROM v_account_age) / 3600.0,
      'queued_at', now(),
      'reason', 'auto: new account crossed risk threshold ' || v_threshold
    ),
    'open'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_flag_new_high_risk_account ON public.profiles;
CREATE TRIGGER trg_auto_flag_new_high_risk_account
AFTER INSERT OR UPDATE OF risk_score ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_flag_new_high_risk_account();

-- 2) Review queue RPC
CREATE OR REPLACE FUNCTION public.admin_new_account_review_queue(_limit int DEFAULT 100)
RETURNS TABLE(
  flag_id uuid,
  user_id uuid,
  display_name text,
  account_created_at timestamptz,
  flag_created_at timestamptz,
  risk_score int,
  severity int,
  details jsonb,
  verified boolean,
  banned_at timestamptz,
  suspended_until timestamptz,
  report_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'super_admin')
          OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    rf.id,
    rf.user_id,
    p.display_name,
    p.created_at,
    rf.created_at,
    p.risk_score,
    rf.severity,
    rf.details,
    p.verified,
    p.banned_at,
    p.suspended_until,
    COALESCE(p.report_count, 0)
  FROM public.risk_flags rf
  JOIN public.profiles p ON p.id = rf.user_id
  WHERE rf.kind = 'new_account_high_risk'
    AND rf.status = 'open'
  ORDER BY rf.severity DESC, rf.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_new_account_review_queue(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_new_account_review_queue(int) TO authenticated, service_role;

-- 3) Resolve action RPC
CREATE OR REPLACE FUNCTION public.admin_resolve_risk_flag(
  _flag_id uuid,
  _decision text,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_flag public.risk_flags%ROWTYPE;
  v_new_status text;
BEGIN
  IF NOT (public.has_role(v_actor,'admin')
          OR public.has_role(v_actor,'super_admin')
          OR public.has_role(v_actor,'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _decision NOT IN ('cleared','false_positive','escalated','resolved') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT * INTO v_flag FROM public.risk_flags WHERE id = _flag_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  IF v_flag.status <> 'open' THEN RAISE EXCEPTION 'flag_not_open'; END IF;

  v_new_status := CASE WHEN _decision = 'escalated' THEN 'escalated' ELSE 'resolved' END;

  UPDATE public.risk_flags
  SET status = v_new_status,
      resolved_at = now(),
      resolved_by = v_actor,
      details = COALESCE(details,'{}'::jsonb) || jsonb_build_object(
        'decision', _decision,
        'notes', _notes,
        'resolved_by', v_actor,
        'resolved_at', now()
      )
  WHERE id = _flag_id;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, severity, after_state)
  VALUES (
    v_actor,
    'risk_flag_resolved',
    'risk_flags',
    _flag_id::text,
    CASE WHEN _decision = 'escalated' THEN 'warning' ELSE 'info' END,
    jsonb_build_object(
      'flag_id', _flag_id,
      'user_id', v_flag.user_id,
      'kind', v_flag.kind,
      'decision', _decision,
      'notes', _notes
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_risk_flag(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_risk_flag(uuid, text, text) TO authenticated, service_role;
