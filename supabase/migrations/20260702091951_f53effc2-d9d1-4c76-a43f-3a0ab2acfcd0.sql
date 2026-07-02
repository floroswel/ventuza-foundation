
-- Enum pentru starea regulii
DO $$ BEGIN
  CREATE TYPE public.policy_rule_state AS ENUM ('draft','shadow','enforcing','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabel principal
CREATE TABLE IF NOT EXISTS public.policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  state public.policy_rule_state NOT NULL DEFAULT 'draft',
  version int NOT NULL DEFAULT 1,
  expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_rules TO authenticated;
GRANT ALL ON public.policy_rules TO service_role;
ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_rules_staff_read" ON public.policy_rules;
CREATE POLICY "policy_rules_staff_read" ON public.policy_rules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Istoric versiuni (append-only)
CREATE TABLE IF NOT EXISTS public.policy_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.policy_rules(id) ON DELETE CASCADE,
  version int NOT NULL,
  state public.policy_rule_state NOT NULL,
  expression jsonb NOT NULL,
  action jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);
GRANT SELECT, INSERT ON public.policy_rule_versions TO authenticated;
GRANT ALL ON public.policy_rule_versions TO service_role;
ALTER TABLE public.policy_rule_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_versions_staff_read" ON public.policy_rule_versions;
CREATE POLICY "policy_versions_staff_read" ON public.policy_rule_versions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Prevenire UPDATE/DELETE pe istoric (append-only)
CREATE OR REPLACE FUNCTION public.prevent_policy_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'policy_rule_versions is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_policy_versions_immutable_upd ON public.policy_rule_versions;
CREATE TRIGGER trg_policy_versions_immutable_upd BEFORE UPDATE OR DELETE ON public.policy_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_policy_version_mutation();

-- Log evaluări (real + shadow)
CREATE TABLE IF NOT EXISTS public.policy_evaluations (
  id bigserial PRIMARY KEY,
  rule_code text NOT NULL,
  rule_version int NOT NULL,
  mode text NOT NULL CHECK (mode IN ('shadow','enforcing')),
  subject_kind text NOT NULL,
  subject_id text,
  matched boolean NOT NULL,
  action_taken text,
  input jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_policy_evals_rule ON public.policy_evaluations(rule_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_evals_time ON public.policy_evaluations(created_at DESC);
GRANT SELECT, INSERT ON public.policy_evaluations TO authenticated;
GRANT ALL ON public.policy_evaluations TO service_role;
ALTER TABLE public.policy_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_evals_staff_read" ON public.policy_evaluations;
CREATE POLICY "policy_evals_staff_read" ON public.policy_evaluations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.policy_rules_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_policy_rules_touch ON public.policy_rules;
CREATE TRIGGER trg_policy_rules_touch BEFORE UPDATE ON public.policy_rules
  FOR EACH ROW EXECUTE FUNCTION public.policy_rules_touch();

-- RPC: upsert rule (creează versiune nouă la fiecare modificare)
CREATE OR REPLACE FUNCTION public.policy_upsert_rule(
  p_code text, p_category text, p_title text, p_description text,
  p_expression jsonb, p_action jsonb, p_change_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule public.policy_rules%ROWTYPE;
  v_actor uuid := auth.uid();
  v_new_version int;
BEGIN
  IF NOT public.has_any_role(v_actor, ARRAY['admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rule FROM public.policy_rules WHERE code = p_code;
  IF NOT FOUND THEN
    INSERT INTO public.policy_rules(code, category, title, description, expression, action, created_by, updated_by)
    VALUES (p_code, p_category, p_title, p_description, p_expression, p_action, v_actor, v_actor)
    RETURNING * INTO v_rule;
    v_new_version := 1;
  ELSE
    v_new_version := v_rule.version + 1;
    UPDATE public.policy_rules
      SET category=p_category, title=p_title, description=p_description,
          expression=p_expression, action=p_action, version=v_new_version, updated_by=v_actor
      WHERE id=v_rule.id RETURNING * INTO v_rule;
  END IF;

  INSERT INTO public.policy_rule_versions(rule_id, version, state, expression, action, changed_by, change_note)
  VALUES (v_rule.id, v_new_version, v_rule.state, p_expression, p_action, v_actor, p_change_note);

  INSERT INTO public.admin_audit_log(actor_id, action, target_kind, target_id, before, after, severity)
  VALUES (v_actor, 'policy_upsert', 'policy_rule', v_rule.id::text,
          jsonb_build_object('version', v_rule.version - 1),
          jsonb_build_object('version', v_new_version, 'code', p_code, 'state', v_rule.state), 'info');

  RETURN v_rule.id;
END $$;
REVOKE ALL ON FUNCTION public.policy_upsert_rule(text,text,text,text,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.policy_upsert_rule(text,text,text,text,jsonb,jsonb,text) TO authenticated;

-- RPC: promote state (draft -> shadow -> enforcing)
CREATE OR REPLACE FUNCTION public.policy_set_state(p_rule_id uuid, p_new_state public.policy_rule_state, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.policy_rule_state;
BEGIN
  IF NOT public.has_any_role(v_actor, ARRAY['admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT state INTO v_old FROM public.policy_rules WHERE id = p_rule_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'rule_not_found'; END IF;

  UPDATE public.policy_rules SET state = p_new_state, updated_by = v_actor WHERE id = p_rule_id;

  INSERT INTO public.admin_audit_log(actor_id, action, target_kind, target_id, before, after, severity)
  VALUES (v_actor, 'policy_state_change', 'policy_rule', p_rule_id::text,
          jsonb_build_object('state', v_old),
          jsonb_build_object('state', p_new_state, 'note', p_note),
          CASE WHEN p_new_state = 'enforcing' THEN 'warning' ELSE 'info' END);
END $$;
REVOKE ALL ON FUNCTION public.policy_set_state(uuid, public.policy_rule_state, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.policy_set_state(uuid, public.policy_rule_state, text) TO authenticated;

-- RPC: simulator/backtest — count match rate în ultimele N zile pe evaluări istorice
CREATE OR REPLACE FUNCTION public.policy_simulate(p_rule_code text, p_days int DEFAULT 7)
RETURNS TABLE (total bigint, matched bigint, match_rate numeric, by_day jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH src AS (
    SELECT matched, date_trunc('day', created_at) AS d
    FROM public.policy_evaluations
    WHERE rule_code = p_rule_code
      AND created_at >= now() - (p_days || ' days')::interval
  ),
  agg AS (
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE matched) AS matched FROM src
  ),
  daily AS (
    SELECT jsonb_agg(jsonb_build_object('day', d, 'total', c, 'matched', m) ORDER BY d) AS by_day
    FROM (SELECT d, COUNT(*) AS c, COUNT(*) FILTER (WHERE matched) AS m FROM src GROUP BY d) x
  )
  SELECT a.total, a.matched,
         CASE WHEN a.total = 0 THEN 0 ELSE ROUND((a.matched::numeric / a.total) * 100, 2) END,
         COALESCE(d.by_day, '[]'::jsonb)
  FROM agg a, daily d;
END $$;
REVOKE ALL ON FUNCTION public.policy_simulate(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.policy_simulate(text, int) TO authenticated;
