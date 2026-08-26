CREATE OR REPLACE FUNCTION public.didit_apply_result(
  _session_id text,
  _status text,
  _result text,
  _estimated_age integer,
  _status_raw jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_age_status public.age_status;
  v_new_age_status public.age_status;
  v_now timestamptz := now();
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.didit_sessions
  WHERE session_id = _session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'didit_session_not_found: %', _session_id USING ERRCODE = 'P0002';
  END IF;

  SELECT age_status INTO v_current_age_status
  FROM public.profiles
  WHERE id = v_user_id;

  v_new_age_status := CASE
    WHEN _result = 'pass' THEN 'verified'::public.age_status
    WHEN _result = 'fail' AND lower(coalesce(_status, '')) IN ('expired', 'kyc_expired') THEN 'expired'::public.age_status
    WHEN _result = 'fail' THEN 'failed'::public.age_status
    WHEN v_current_age_status = 'verified'::public.age_status THEN 'verified'::public.age_status
    ELSE 'pending'::public.age_status
  END;

  UPDATE public.didit_sessions
  SET status = coalesce(_status, status),
      result = _result,
      estimated_age = _estimated_age,
      status_raw = _status_raw,
      resolved_at = CASE
        WHEN _result IN ('pass', 'fail') THEN coalesce(resolved_at, v_now)
        ELSE resolved_at
      END
  WHERE session_id = _session_id;

  UPDATE public.profiles
  SET age_status = v_new_age_status,
      age_provider = 'didit',
      age_verified_at = CASE
        WHEN _result = 'pass' THEN coalesce(age_verified_at, v_now)
        WHEN _result = 'fail' THEN NULL
        ELSE age_verified_at
      END,
      verified = CASE
        WHEN _result = 'pass' THEN true
        WHEN _result = 'fail' THEN false
        ELSE verified
      END,
      verified_at = CASE
        WHEN _result = 'pass' THEN coalesce(verified_at, v_now)
        WHEN _result = 'fail' THEN NULL
        ELSE verified_at
      END,
      verification_status = CASE
        WHEN _result = 'pass' THEN 'verified'
        WHEN _result = 'fail' THEN 'rejected'
        WHEN v_current_age_status = 'verified'::public.age_status THEN verification_status
        ELSE 'pending'
      END,
      verification_method = 'didit'
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) TO service_role;