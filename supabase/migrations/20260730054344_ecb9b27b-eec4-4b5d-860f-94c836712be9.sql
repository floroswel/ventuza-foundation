
-- ============================================================
-- SUZETA AUTONOMOUS APP GUARDIAN — schema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guardian_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'unknown',
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  event_count integer NOT NULL DEFAULT 0,
  users_affected integer NOT NULL DEFAULT 0,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  probable_cause text,
  proposed_fix text,
  risk text,
  impact text,
  affected_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guardian_incidents TO authenticated;
GRANT ALL ON public.guardian_incidents TO service_role;
ALTER TABLE public.guardian_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_incidents_staff_read" ON public.guardian_incidents;
CREATE POLICY "guardian_incidents_staff_read" ON public.guardian_incidents
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.guardian_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.guardian_incidents(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'unknown',
  message text NOT NULL,
  stack text,
  route text,
  user_id uuid,
  app_version text,
  platform text,
  client_info text,
  request_id text,
  breadcrumbs jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guardian_events TO authenticated;
GRANT ALL ON public.guardian_events TO service_role;
ALTER TABLE public.guardian_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_events_staff_read" ON public.guardian_events;
CREATE POLICY "guardian_events_staff_read" ON public.guardian_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS guardian_events_created_idx ON public.guardian_events (created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_events_fp_idx ON public.guardian_events (fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_incidents_status_idx ON public.guardian_incidents (status, last_seen DESC);

CREATE TABLE IF NOT EXISTS public.guardian_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.guardian_incidents(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  decision text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  risk text NOT NULL DEFAULT 'low',
  reversible boolean NOT NULL DEFAULT true,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guardian_actions TO authenticated;
GRANT ALL ON public.guardian_actions TO service_role;
ALTER TABLE public.guardian_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_actions_staff_read" ON public.guardian_actions;
CREATE POLICY "guardian_actions_staff_read" ON public.guardian_actions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- append-only pentru jurnalul de evenimente
CREATE OR REPLACE FUNCTION public.guardian_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'guardian_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS guardian_events_no_mutation ON public.guardian_events;
CREATE TRIGGER guardian_events_no_mutation
  BEFORE UPDATE OR DELETE ON public.guardian_events
  FOR EACH ROW EXECUTE FUNCTION public.guardian_events_immutable();

CREATE OR REPLACE FUNCTION public.guardian_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS guardian_incidents_touch ON public.guardian_incidents;
CREATE TRIGGER guardian_incidents_touch BEFORE UPDATE ON public.guardian_incidents
  FOR EACH ROW EXECUTE FUNCTION public.guardian_touch_updated_at();

DROP TRIGGER IF EXISTS guardian_actions_touch ON public.guardian_actions;
CREATE TRIGGER guardian_actions_touch BEFORE UPDATE ON public.guardian_actions
  FOR EACH ROW EXECUTE FUNCTION public.guardian_touch_updated_at();

-- ============================================================
-- INGEST — apelabil de useri autentificați, rate limited
-- ============================================================
CREATE OR REPLACE FUNCTION public.guardian_ingest(
  _fingerprint text,
  _severity text,
  _category text,
  _message text,
  _stack text DEFAULT NULL,
  _route text DEFAULT NULL,
  _app_version text DEFAULT NULL,
  _platform text DEFAULT NULL,
  _client_info text DEFAULT NULL,
  _request_id text DEFAULT NULL,
  _breadcrumbs jsonb DEFAULT '[]'::jsonb,
  _context jsonb DEFAULT '{}'::jsonb,
  _environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hits integer;
  v_inc public.guardian_incidents%ROWTYPE;
  v_sev text := lower(coalesce(_severity, 'medium'));
  v_users integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'anonymous');
  END IF;

  SELECT count(*) INTO v_hits
  FROM public.rate_limit_log
  WHERE user_id = v_uid AND action = 'guardian_ingest' AND created_at > now() - interval '1 hour';
  IF v_hits > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  INSERT INTO public.rate_limit_log (user_id, action) VALUES (v_uid, 'guardian_ingest');

  IF v_sev NOT IN ('low', 'medium', 'high', 'critical') THEN v_sev := 'medium'; END IF;

  INSERT INTO public.guardian_incidents (fingerprint, title, category, severity, sample)
  VALUES (
    left(coalesce(_fingerprint, 'unknown'), 200),
    left(coalesce(_message, 'unknown'), 300),
    left(coalesce(_category, 'unknown'), 60),
    v_sev,
    jsonb_build_object('route', _route, 'message', left(coalesce(_message,''), 500))
  )
  ON CONFLICT (fingerprint) DO UPDATE
    SET last_seen = now(),
        severity = CASE
          WHEN public.guardian_incidents.severity = 'critical' OR EXCLUDED.severity = 'critical' THEN 'critical'
          WHEN public.guardian_incidents.severity = 'high' OR EXCLUDED.severity = 'high' THEN 'high'
          ELSE public.guardian_incidents.severity END,
        status = CASE WHEN public.guardian_incidents.status = 'resolved' THEN 'open'
                      ELSE public.guardian_incidents.status END
  RETURNING * INTO v_inc;

  INSERT INTO public.guardian_events (
    incident_id, fingerprint, severity, category, message, stack, route, user_id,
    app_version, platform, client_info, request_id, breadcrumbs, context, environment
  ) VALUES (
    v_inc.id, v_inc.fingerprint, v_sev, left(coalesce(_category,'unknown'),60),
    left(coalesce(_message,'unknown'), 2000), left(coalesce(_stack,''), 8000),
    left(coalesce(_route,''), 300), v_uid, left(coalesce(_app_version,''), 40),
    left(coalesce(_platform,''), 40), left(coalesce(_client_info,''), 300),
    left(coalesce(_request_id,''), 80), coalesce(_breadcrumbs, '[]'::jsonb),
    coalesce(_context, '{}'::jsonb), left(coalesce(_environment,'production'), 20)
  );

  SELECT count(DISTINCT user_id) INTO v_users
  FROM public.guardian_events WHERE fingerprint = v_inc.fingerprint;

  UPDATE public.guardian_incidents
     SET event_count = event_count + 1, users_affected = v_users
   WHERE id = v_inc.id;

  RETURN jsonb_build_object('ok', true, 'incident_id', v_inc.id, 'severity', v_sev);
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_ingest(text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_ingest(text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text) TO authenticated, service_role;

-- ============================================================
-- DASHBOARD + RAPOARTE (staff only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guardian_dashboard(_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(_hours,24), 720)));
  v_res jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_hours', _hours,
    'totals', (
      SELECT jsonb_build_object(
        'events', count(*),
        'critical', count(*) FILTER (WHERE severity = 'critical'),
        'high', count(*) FILTER (WHERE severity = 'high'),
        'users_affected', count(DISTINCT user_id)
      ) FROM public.guardian_events WHERE created_at > v_since
    ),
    'open_incidents', (
      SELECT count(*) FROM public.guardian_incidents WHERE status IN ('open','mitigated')
    ),
    'resolved_incidents', (
      SELECT count(*) FROM public.guardian_incidents WHERE status = 'resolved'
    ),
    'by_category', coalesce((
      SELECT jsonb_agg(x) FROM (
        SELECT category, count(*) AS events, count(DISTINCT user_id) AS users
        FROM public.guardian_events WHERE created_at > v_since
        GROUP BY category ORDER BY count(*) DESC LIMIT 30
      ) x), '[]'::jsonb),
    'hourly', coalesce((
      SELECT jsonb_agg(x ORDER BY x.bucket) FROM (
        SELECT date_trunc('hour', created_at) AS bucket, count(*) AS events
        FROM public.guardian_events WHERE created_at > v_since
        GROUP BY 1
      ) x), '[]'::jsonb),
    'incidents', coalesce((
      SELECT jsonb_agg(to_jsonb(i)) FROM (
        SELECT id, fingerprint, title, category, severity, status, event_count,
               users_affected, first_seen, last_seen, probable_cause, proposed_fix,
               risk, impact, affected_files, sample
        FROM public.guardian_incidents
        ORDER BY (status IN ('open','mitigated')) DESC,
                 CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 last_seen DESC
        LIMIT 100
      ) i), '[]'::jsonb),
    'actions', coalesce((
      SELECT jsonb_agg(to_jsonb(a)) FROM (
        SELECT id, incident_id, action_type, decision, status, risk, reversible,
               summary, payload, result, decided_by, decided_at, decision_reason,
               executed_at, created_at
        FROM public.guardian_actions
        ORDER BY (status = 'pending') DESC, created_at DESC
        LIMIT 100
      ) a), '[]'::jsonb),
    'recent_events', coalesce((
      SELECT jsonb_agg(to_jsonb(e)) FROM (
        SELECT id, severity, category, message, route, app_version, platform,
               request_id, created_at
        FROM public.guardian_events ORDER BY created_at DESC LIMIT 50
      ) e), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_dashboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_dashboard(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guardian_report(_period text DEFAULT 'daily')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := CASE WHEN lower(coalesce(_period,'daily')) = 'weekly'
                              THEN now() - interval '7 days' ELSE now() - interval '1 day' END;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'period', lower(coalesce(_period,'daily')),
    'from', v_since,
    'to', now(),
    'events', (SELECT count(*) FROM public.guardian_events WHERE created_at > v_since),
    'critical', (SELECT count(*) FROM public.guardian_events WHERE created_at > v_since AND severity='critical'),
    'users_affected', (SELECT count(DISTINCT user_id) FROM public.guardian_events WHERE created_at > v_since),
    'new_incidents', (SELECT count(*) FROM public.guardian_incidents WHERE first_seen > v_since),
    'resolved_incidents', (SELECT count(*) FROM public.guardian_incidents WHERE resolved_at > v_since),
    'auto_actions', (SELECT count(*) FROM public.guardian_actions WHERE created_at > v_since AND status='executed'),
    'pending_approvals', (SELECT count(*) FROM public.guardian_actions WHERE status='pending'),
    'top_incidents', coalesce((
      SELECT jsonb_agg(x) FROM (
        SELECT title, category, severity, event_count, users_affected, last_seen
        FROM public.guardian_incidents WHERE last_seen > v_since
        ORDER BY event_count DESC LIMIT 15
      ) x), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_report(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_report(text) TO authenticated, service_role;

-- ============================================================
-- ACȚIUNI: propunere (automată) + decizie umană
-- ============================================================
CREATE OR REPLACE FUNCTION public.guardian_propose_action(
  _incident_id uuid,
  _action_type text,
  _decision text,
  _risk text,
  _reversible boolean,
  _summary text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _auto_executed boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  -- acțiunile cu risc / ireversibile nu pot fi marcate executate automat
  IF _auto_executed AND (coalesce(_reversible, false) = false OR lower(coalesce(_risk,'low')) <> 'low') THEN
    RAISE EXCEPTION 'guardian_unsafe_auto_action' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.guardian_actions (
    incident_id, action_type, decision, status, risk, reversible, summary, payload,
    requested_by, executed_at
  ) VALUES (
    _incident_id, left(coalesce(_action_type,'unknown'),60), left(coalesce(_decision,'E'),40),
    CASE WHEN _auto_executed THEN 'executed' ELSE 'pending' END,
    lower(coalesce(_risk,'low')), coalesce(_reversible, true),
    left(coalesce(_summary,''), 500), coalesce(_payload,'{}'::jsonb),
    auth.uid(), CASE WHEN _auto_executed THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_propose_action(uuid,text,text,text,boolean,text,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_propose_action(uuid,text,text,text,boolean,text,jsonb,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guardian_decide_action(
  _action_id uuid,
  _decision text,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_action public.guardian_actions%ROWTYPE;
BEGIN
  IF NOT public.is_admin_or_above(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF coalesce(length(trim(_reason)), 0) < 10 THEN
    RAISE EXCEPTION 'justification_required' USING ERRCODE = '22023';
  END IF;

  v_status := CASE lower(_decision)
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'rollback' THEN 'rolled_back'
    ELSE NULL END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.guardian_actions
     SET status = v_status, decided_by = v_uid, decided_at = now(),
         decision_reason = left(_reason, 500),
         executed_at = CASE WHEN v_status = 'approved' THEN now() ELSE executed_at END
   WHERE id = _action_id
  RETURNING * INTO v_action;

  IF v_action.id IS NULL THEN
    RAISE EXCEPTION 'action_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata, severity)
  VALUES (v_uid, 'guardian_' || v_status, 'guardian_action', v_action.id::text,
          jsonb_build_object('action_type', v_action.action_type, 'incident_id', v_action.incident_id,
                             'reason', left(_reason, 500)),
          CASE WHEN v_action.risk IN ('high','critical') THEN 'critical' ELSE 'info' END);

  RETURN to_jsonb(v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_decide_action(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_decide_action(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guardian_set_incident_status(
  _incident_id uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inc public.guardian_incidents%ROWTYPE;
BEGIN
  IF NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF lower(coalesce(_status,'')) NOT IN ('open','mitigated','resolved','ignored') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.guardian_incidents
     SET status = lower(_status),
         resolved_at = CASE WHEN lower(_status) = 'resolved' THEN now() ELSE NULL END,
         resolved_by = CASE WHEN lower(_status) = 'resolved' THEN v_uid ELSE NULL END,
         probable_cause = coalesce(_note, probable_cause)
   WHERE id = _incident_id
  RETURNING * INTO v_inc;

  IF v_inc.id IS NULL THEN
    RAISE EXCEPTION 'incident_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata, severity)
  VALUES (v_uid, 'guardian_incident_' || lower(_status), 'guardian_incident', v_inc.id::text,
          jsonb_build_object('title', v_inc.title, 'note', left(coalesce(_note,''), 500)), 'info');

  RETURN to_jsonb(v_inc);
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_set_incident_status(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_set_incident_status(uuid,text,text) TO authenticated, service_role;

-- retenție: 90 zile
CREATE OR REPLACE FUNCTION public.guardian_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  ALTER TABLE public.guardian_events DISABLE TRIGGER guardian_events_no_mutation;
  DELETE FROM public.guardian_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ALTER TABLE public.guardian_events ENABLE TRIGGER guardian_events_no_mutation;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_cleanup() TO service_role;
