-- Claim business application by code (orphan reclaim by authenticated user).
-- Server-side: matches an application that has NULL user_id, sets user_id to caller.
-- Refuses if already claimed or doesn't exist.
CREATE OR REPLACE FUNCTION public.claim_business_application_by_code(_app_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  SELECT id, user_id, status, legal_name INTO v_row
    FROM public.business_applications WHERE id = _app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.user_id IS NOT NULL AND v_row.user_id <> v_uid THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '42501';
  END IF;
  IF v_row.user_id IS NULL THEN
    UPDATE public.business_applications SET user_id = v_uid, updated_at = now() WHERE id = _app_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'legal_name', v_row.legal_name);
END $$;

REVOKE ALL ON FUNCTION public.claim_business_application_by_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_business_application_by_code(uuid) TO authenticated;