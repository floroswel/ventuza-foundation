CREATE TABLE IF NOT EXISTS public.didit_sessions (
  session_id       text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id      text,
  status           text NOT NULL DEFAULT 'created',
  result           text,
  estimated_age    integer,
  status_raw       jsonb,
  session_url      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);

CREATE INDEX IF NOT EXISTS didit_sessions_user_id_idx
  ON public.didit_sessions(user_id);

GRANT SELECT ON public.didit_sessions TO authenticated;
GRANT ALL    ON public.didit_sessions TO service_role;

ALTER TABLE public.didit_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS didit_sessions_owner_select ON public.didit_sessions;
CREATE POLICY didit_sessions_owner_select
  ON public.didit_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.didit_link_session(
  _session_id  text,
  _workflow_id text,
  _session_url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.didit_sessions (session_id, user_id, workflow_id, session_url, status)
  VALUES (_session_id, auth.uid(), _workflow_id, _session_url, 'created')
  ON CONFLICT (session_id) DO NOTHING;

  UPDATE public.profiles
     SET age_status   = 'pending',
         age_provider = 'didit'
   WHERE id = auth.uid()
     AND (age_status IS DISTINCT FROM 'verified');
END;
$$;

REVOKE ALL ON FUNCTION public.didit_link_session(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.didit_link_session(text, text, text) TO authenticated;

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
  v_new_age_status text;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.didit_sessions
   WHERE session_id = _session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'didit_session_not_found: %', _session_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.didit_sessions
     SET status        = COALESCE(_status, status),
         result        = _result,
         estimated_age = _estimated_age,
         status_raw    = _status_raw,
         resolved_at   = CASE WHEN _result IN ('pass','fail') THEN now() ELSE resolved_at END
   WHERE session_id = _session_id;

  v_new_age_status := CASE _result
    WHEN 'pass' THEN 'verified'
    WHEN 'fail' THEN 'failed'
    ELSE 'pending'
  END;

  UPDATE public.profiles
     SET age_status       = v_new_age_status,
         age_provider     = 'didit',
         age_verified_at  = CASE WHEN _result = 'pass' THEN now() ELSE age_verified_at END
   WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.didit_apply_result(text, text, text, integer, jsonb) TO service_role;