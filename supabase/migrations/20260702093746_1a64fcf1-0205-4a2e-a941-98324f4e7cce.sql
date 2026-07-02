
CREATE OR REPLACE FUNCTION public.policy_evaluate(
  _category text,
  _subject_kind text,
  _subject_id text,
  _input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_when jsonb;
  v_field text;
  v_op text;
  v_value jsonb;
  v_actual jsonb;
  v_matched boolean;
  v_enforce_action jsonb := NULL;
  v_matched_rules jsonb := '[]'::jsonb;
  v_action_text text;
BEGIN
  FOR r IN
    SELECT id, code, version, state, expression, action
    FROM public.policy_rules
    WHERE category = _category
      AND state IN ('shadow','enforcing')
    ORDER BY state DESC, code ASC
  LOOP
    v_when := COALESCE(r.expression->'when', '{}'::jsonb);
    v_field := v_when->>'field';
    v_op := COALESCE(v_when->>'op','==');
    v_value := v_when->'value';
    v_actual := _input-> v_field;
    v_matched := false;

    IF v_field IS NOT NULL AND v_actual IS NOT NULL AND v_value IS NOT NULL THEN
      BEGIN
        v_matched := CASE v_op
          WHEN '>='  THEN (v_actual::text)::numeric >= (v_value::text)::numeric
          WHEN '>'   THEN (v_actual::text)::numeric >  (v_value::text)::numeric
          WHEN '<='  THEN (v_actual::text)::numeric <= (v_value::text)::numeric
          WHEN '<'   THEN (v_actual::text)::numeric <  (v_value::text)::numeric
          WHEN '=='  THEN v_actual = v_value
          WHEN '!='  THEN v_actual <> v_value
          WHEN 'in'  THEN v_value ? (v_actual #>> '{}')
          WHEN 'contains' THEN (v_actual #>> '{}') ILIKE '%' || (v_value #>> '{}') || '%'
          ELSE false
        END;
      EXCEPTION WHEN OTHERS THEN
        v_matched := false;
      END;
    END IF;

    v_action_text := NULLIF(r.action->>'type','');

    INSERT INTO public.policy_evaluations
      (rule_code, rule_version, mode, subject_kind, subject_id, matched, action_taken, input)
    VALUES
      (r.code, r.version, r.state, _subject_kind, _subject_id, v_matched,
       CASE WHEN v_matched AND r.state = 'enforcing' THEN v_action_text ELSE NULL END,
       _input);

    IF v_matched THEN
      v_matched_rules := v_matched_rules || jsonb_build_object(
        'code', r.code, 'version', r.version, 'state', r.state, 'action', r.action
      );
      IF r.state = 'enforcing' AND v_enforce_action IS NULL THEN
        v_enforce_action := r.action;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'matched', v_matched_rules,
    'enforce', v_enforce_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.policy_evaluate(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.policy_evaluate(text, text, text, jsonb) TO authenticated, service_role;
