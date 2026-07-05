CREATE OR REPLACE FUNCTION public.sync_age_status_from_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    NEW.age_status := CASE NEW.verification_status
      WHEN 'approved' THEN 'verified'::public.age_status
      WHEN 'verified' THEN 'verified'::public.age_status
      WHEN 'rejected' THEN 'failed'::public.age_status
      WHEN 'pending'  THEN 'pending'::public.age_status
      ELSE 'unverified'::public.age_status
    END;
    IF NEW.verification_status IN ('approved', 'verified') AND NEW.age_verified_at IS NULL THEN
      NEW.age_verified_at := now();
    END IF;
    IF NEW.verification_status = 'pending' AND NEW.age_pending_at IS NULL THEN
      NEW.age_pending_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.didit_apply_result(
  _session_id     text,
  _status         text,
  _result         text,
  _estimated_age  integer,
  _status_raw     jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_age_status public.age_status;
  v_now timestamptz := now();
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.didit_sessions
   WHERE session_id = _session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'didit_session_not_found: %', _session_id USING ERRCODE = 'P0002';
  END IF;

  v_new_age_status := CASE _result
    WHEN 'pass' THEN 'verified'::public.age_status
    WHEN 'fail' THEN 'failed'::public.age_status
    ELSE 'pending'::public.age_status
  END;

  UPDATE public.didit_sessions
     SET status        = COALESCE(_status, status),
         result        = _result,
         estimated_age = _estimated_age,
         status_raw    = _status_raw,
         resolved_at   = CASE WHEN _result IN ('pass','fail') THEN COALESCE(resolved_at, v_now) ELSE resolved_at END
   WHERE session_id = _session_id;

  UPDATE public.profiles
     SET age_status          = v_new_age_status,
         age_provider        = 'didit',
         age_verified_at     = CASE WHEN _result = 'pass' THEN COALESCE(age_verified_at, v_now) ELSE NULL END,
         verified            = CASE WHEN _result = 'pass' THEN true WHEN _result = 'fail' THEN false ELSE COALESCE(verified, false) END,
         verified_at         = CASE WHEN _result = 'pass' THEN COALESCE(verified_at, v_now) WHEN _result = 'fail' THEN NULL ELSE verified_at END,
         verification_status = CASE _result
           WHEN 'pass' THEN 'verified'
           WHEN 'fail' THEN 'rejected'
           ELSE 'pending'
         END,
         verification_method = 'didit'
   WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_age_status_from_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) TO service_role;