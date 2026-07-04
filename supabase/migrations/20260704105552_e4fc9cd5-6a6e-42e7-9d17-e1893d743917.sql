CREATE OR REPLACE FUNCTION public.verification_moderator_take(p_request_id uuid)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _req public.verification_requests;
BEGIN
  IF NOT public.is_verification_staff(_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT * INTO _req FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42704'; END IF;

  -- Second reviewer path
  IF _req.needs_second AND _req.moderator_id IS DISTINCT FROM _uid THEN
    UPDATE public.verification_requests
       SET second_moderator_id = _uid,
           claimed_at = COALESCE(claimed_at, now())
     WHERE id = p_request_id
     RETURNING * INTO _req;
    RETURN _req;
  END IF;

  -- Owner claim (idempotent)
  IF _req.moderator_id IS NULL OR _req.moderator_id = _uid THEN
    UPDATE public.verification_requests
       SET moderator_id = _uid,
           claimed_at = COALESCE(claimed_at, now()),
           status = CASE WHEN status = 'pending' THEN 'in_review' ELSE status END
     WHERE id = p_request_id
     RETURNING * INTO _req;
    RETURN _req;
  END IF;

  RAISE EXCEPTION 'already_claimed_by_other' USING ERRCODE='42501';
END; $$;

REVOKE ALL ON FUNCTION public.verification_moderator_take(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_moderator_take(uuid) TO authenticated, service_role;