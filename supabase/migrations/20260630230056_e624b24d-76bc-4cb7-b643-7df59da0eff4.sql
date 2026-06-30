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
  v_display text;
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

  -- On escalation, raise a critical admin alert so other admins see it in real time
  IF _decision = 'escalated' THEN
    SELECT COALESCE(display_name, id::text) INTO v_display
      FROM public.profiles WHERE id = v_flag.user_id;

    INSERT INTO public.admin_alerts(kind, severity, title, body, target_table, target_id)
    VALUES (
      'risk_flag_escalated',
      'critical',
      'Risk flag escalat: ' || COALESCE(v_display, v_flag.user_id::text),
      COALESCE(NULLIF(_notes, ''), 'Escaladat fără notă') ||
        ' · kind=' || v_flag.kind ||
        ' · severity=' || COALESCE(v_flag.severity::text, '?'),
      'risk_flags',
      _flag_id::text
    );
  END IF;
END;
$$;