CREATE OR REPLACE FUNCTION public.verification_decide_invariants_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src text;
  result jsonb;
BEGIN
  SELECT p.prosrc INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'verification_moderator_decide'
   LIMIT 1;

  IF src IS NULL THEN
    RETURN jsonb_build_object('present', false);
  END IF;

  result := jsonb_build_object(
    'present', true,
    -- Validări obligatorii
    'validates_decision',         src ~* 'invalid_decision',
    'validates_reason_code_req',  src ~* 'reason_code_required',
    'validates_reason_code_enum', src ~* 'invalid_reason_code',
    'validates_confidence',       src ~* 'invalid_confidence',
    'validates_reason_length',    src ~* 'reason_required',
    'validates_not_found',        src ~* 'not_found',
    'validates_not_your_claim',   src ~* 'not_your_claim',
    'validates_forbidden',        src ~* 'forbidden',
    'validates_second_binary',    src ~* 'second_review_binary',
    -- Logging (RAISE WARNING cu actor + request)
    'warns_reason_code',   src ~* 'RAISE WARNING.*invalid_reason_code.*actor.*request',
    'warns_confidence',    src ~* 'RAISE WARNING.*invalid_confidence.*actor.*request',
    'warns_reason_req',    src ~* 'RAISE WARNING.*reason_required.*actor.*request',
    'warns_reason_code_req', src ~* 'RAISE WARNING.*reason_code_required.*actor.*request',
    'warns_invalid_decision', src ~* 'RAISE WARNING.*invalid_decision.*actor.*request',
    'warns_not_your_claim',  src ~* 'RAISE WARNING.*not_your_claim.*actor.*request',
    'warns_not_found',       src ~* 'RAISE WARNING.*not_found.*actor.*request',
    'warns_forbidden',       src ~* 'RAISE WARNING.*forbidden.*actor.*request',
    'warns_second_binary',   src ~* 'RAISE WARNING.*second_review_binary.*actor.*request',
    -- Enum-uri complete
    'allowed_reason_codes_complete', (
      src ~* 'low_quality' AND src ~* 'face_not_visible' AND src ~* 'multiple_people'
      AND src ~* 'suspected_fake' AND src ~* 'underage_suspicion' AND src ~* 'replay_attack'
      AND src ~* 'deepfake_suspicion' AND src ~* '''other'''
    ),
    'allowed_confidence_complete', (src ~* '''low''' AND src ~* '''medium''' AND src ~* '''high''')
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.verification_decide_invariants_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_decide_invariants_snapshot() TO anon, authenticated, service_role;