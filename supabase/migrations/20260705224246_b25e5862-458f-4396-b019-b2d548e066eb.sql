
-- Staff (admin, super_admin, moderator) are exempt from the age-gate at the DB
-- level so they can test messaging and moderate accounts without a Didit pass.
-- Regular users are still blocked exactly as before.

CREATE OR REPLACE FUNCTION public.assert_account_usable()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_age_enforce boolean;
  v_age_status text;
  v_is_staff boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email_confirmed_at INTO v_confirmed_at
    FROM auth.users WHERE id = v_uid;
  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  -- Staff bypass: admins/moderators must be able to test & moderate.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_uid
       AND role IN ('super_admin','admin','moderator')
  ) INTO v_is_staff;
  IF v_is_staff THEN RETURN; END IF;

  SELECT COALESCE(enabled, true) INTO v_age_enforce
    FROM public.feature_flags WHERE key = 'age_verification';
  IF v_age_enforce IS NULL THEN v_age_enforce := true; END IF;

  IF v_age_enforce THEN
    SELECT age_status::text INTO v_age_status
      FROM public.profiles WHERE id = v_uid;
    IF v_age_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.require_age_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status public.age_status;
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role IN ('super_admin','admin','moderator')
  ) INTO v_is_staff;
  IF v_is_staff THEN RETURN NEW; END IF;

  SELECT age_status INTO v_status FROM public.profiles WHERE id = auth.uid();
  IF v_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Trebuie să îți confirmi vârsta (18+) înainte de a folosi această funcție.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
