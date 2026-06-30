
-- Add staff notes + status transitions for risk_flags (open ↔ in_progress → resolved/escalated/false_positive)
-- Notes live in details.notes_log[] (append-only, with actor + ts), audited in admin_audit_log.

CREATE OR REPLACE FUNCTION public.admin_add_risk_flag_note(_flag_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_flag public.risk_flags%ROWTYPE;
  v_entry jsonb;
BEGIN
  IF NOT (public.has_role(v_actor,'admin')
          OR public.has_role(v_actor,'super_admin')
          OR public.has_role(v_actor,'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _note IS NULL OR length(btrim(_note)) = 0 THEN
    RAISE EXCEPTION 'note_required';
  END IF;
  IF length(_note) > 2000 THEN
    RAISE EXCEPTION 'note_too_long';
  END IF;

  SELECT * INTO v_flag FROM public.risk_flags WHERE id = _flag_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;

  v_entry := jsonb_build_object(
    'actor', v_actor,
    'at', now(),
    'note', _note
  );

  UPDATE public.risk_flags
  SET details = jsonb_set(
    COALESCE(details,'{}'::jsonb),
    '{notes_log}',
    COALESCE(details->'notes_log','[]'::jsonb) || jsonb_build_array(v_entry),
    true
  )
  WHERE id = _flag_id;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, severity, after_state)
  VALUES (
    v_actor, 'risk_flag_note_added', 'risk_flags', _flag_id::text, 'info',
    jsonb_build_object('flag_id', _flag_id, 'user_id', v_flag.user_id, 'note', _note)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_risk_flag_status(_flag_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_flag public.risk_flags%ROWTYPE;
  v_prev_status text;
  v_entry jsonb;
  v_details jsonb;
BEGIN
  IF NOT (public.has_role(v_actor,'admin')
          OR public.has_role(v_actor,'super_admin')
          OR public.has_role(v_actor,'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status NOT IN ('open','in_progress','resolved','escalated','false_positive') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_flag FROM public.risk_flags WHERE id = _flag_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  v_prev_status := v_flag.status;

  v_details := COALESCE(v_flag.details,'{}'::jsonb) || jsonb_build_object(
    'last_status_change', jsonb_build_object(
      'from', v_prev_status, 'to', _status, 'actor', v_actor, 'at', now()
    )
  );

  IF _note IS NOT NULL AND length(btrim(_note)) > 0 THEN
    IF length(_note) > 2000 THEN RAISE EXCEPTION 'note_too_long'; END IF;
    v_entry := jsonb_build_object(
      'actor', v_actor, 'at', now(), 'note', _note,
      'status_change', jsonb_build_object('from', v_prev_status, 'to', _status)
    );
    v_details := jsonb_set(
      v_details, '{notes_log}',
      COALESCE(v_details->'notes_log','[]'::jsonb) || jsonb_build_array(v_entry),
      true
    );
  END IF;

  UPDATE public.risk_flags
  SET status = _status,
      details = v_details,
      resolved_at = CASE WHEN _status IN ('resolved','escalated','false_positive') THEN now() ELSE NULL END,
      resolved_by = CASE WHEN _status IN ('resolved','escalated','false_positive') THEN v_actor ELSE NULL END
  WHERE id = _flag_id;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, severity, before_state, after_state)
  VALUES (
    v_actor, 'risk_flag_status_changed', 'risk_flags', _flag_id::text,
    CASE WHEN _status = 'escalated' THEN 'warning' ELSE 'info' END,
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', _status, 'note', _note, 'user_id', v_flag.user_id, 'kind', v_flag.kind)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_risk_flag_note(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_risk_flag_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_risk_flag_note(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_risk_flag_status(uuid, text, text) TO authenticated, service_role;
