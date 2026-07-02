-- Alert rules engine
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_kind TEXT NOT NULL,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold INTEGER NOT NULL DEFAULT 1,
  window_seconds INTEGER NOT NULL DEFAULT 3600,
  severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','high','critical')),
  destination JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.alert_rules_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.alert_rules_id_seq TO service_role;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read alert_rules" ON public.alert_rules
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "admin manage alert_rules" ON public.alert_rules
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE OR REPLACE FUNCTION public.alert_rules_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_rules_touch ON public.alert_rules;
CREATE TRIGGER trg_alert_rules_touch
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.alert_rules_touch_updated_at();

-- Extend admin_alerts with assignment / SLA / escalation
ALTER TABLE public.admin_alerts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_alert_id BIGINT REFERENCES public.admin_alerts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rule_id BIGINT REFERENCES public.alert_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_assigned_to ON public.admin_alerts(assigned_to) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_due_at ON public.admin_alerts(due_at) WHERE resolved_at IS NULL;

-- Assign RPC (staff only) with audit
CREATE OR REPLACE FUNCTION public.admin_assign_alert(_alert_id BIGINT, _assignee UUID, _due TIMESTAMPTZ DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.admin_alerts
    SET assigned_to = _assignee,
        due_at = COALESCE(_due, due_at)
    WHERE id = _alert_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, after, severity)
  VALUES (
    v_actor,
    'alert.assign',
    'admin_alerts',
    _alert_id::text,
    jsonb_build_object('assignee', _assignee, 'due_at', _due),
    'info'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_alert(BIGINT, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_alert(BIGINT, UUID, TIMESTAMPTZ) TO authenticated;