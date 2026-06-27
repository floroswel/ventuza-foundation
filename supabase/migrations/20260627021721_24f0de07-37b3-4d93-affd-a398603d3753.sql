CREATE OR REPLACE FUNCTION public.compute_profile_completion(p public.profiles)
RETURNS smallint
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public
AS $$
DECLARE
  s int := 0;
BEGIN
  IF p.display_name IS NOT NULL AND length(trim(p.display_name)) > 0 THEN s := s + 10; END IF;
  IF p.bio IS NOT NULL AND length(trim(p.bio)) >= 20 THEN s := s + 10; END IF;
  IF p.birthdate IS NOT NULL THEN s := s + 5; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 1 THEN s := s + 15; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 3 THEN s := s + 10; END IF;
  IF p.gender IS NOT NULL AND array_length(p.gender,1) > 0 THEN s := s + 5; END IF;
  IF p.orientation IS NOT NULL AND array_length(p.orientation,1) > 0 THEN s := s + 5; END IF;
  IF p.tribes IS NOT NULL AND array_length(p.tribes,1) > 0 THEN s := s + 5; END IF;
  IF p.looking_for IS NOT NULL AND array_length(p.looking_for,1) > 0 THEN s := s + 5; END IF;
  IF p.interests IS NOT NULL AND array_length(p.interests,1) > 0 THEN s := s + 5; END IF;
  IF p.height_cm IS NOT NULL THEN s := s + 3; END IF;
  IF p.weight_kg IS NOT NULL THEN s := s + 3; END IF;
  IF p.body_type IS NOT NULL THEN s := s + 3; END IF;
  IF p.position IS NOT NULL THEN s := s + 3; END IF;

  -- Datele HIV sunt criptate la nivel de coloană. Nu referim coloane plaintext eliminate.
  -- Nu decriptăm aici; verificăm doar existența valorii criptate pentru scorul propriu de completare.
  IF p.hiv_status_enc IS NOT NULL THEN s := s + 3; END IF;

  IF p.verified IS TRUE THEN s := s + 10; END IF;
  RETURN LEAST(s, 100)::smallint;
END
$$;

COMMENT ON FUNCTION public.compute_profile_completion(public.profiles) IS
  'Profile completion calculator. HIV health data must be referenced only via encrypted *_enc columns; plaintext hiv_status/hiv_test_date do not exist.';

CREATE OR REPLACE FUNCTION public.assert_no_plaintext_hiv_profile_completion()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO public
AS $$
DECLARE
  fdef text;
BEGIN
  SELECT pg_get_functiondef('public.compute_profile_completion(public.profiles)'::regprocedure) INTO fdef;
  IF fdef ~ '\mp\.hiv_status\M' OR fdef ~ '\mp\.hiv_test_date\M' THEN
    RAISE EXCEPTION 'regression: compute_profile_completion references plaintext HIV columns';
  END IF;
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.assert_no_plaintext_hiv_profile_completion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_no_plaintext_hiv_profile_completion() TO service_role;

SELECT public.assert_no_plaintext_hiv_profile_completion();