CREATE OR REPLACE FUNCTION public.assert_account_usable()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_age_enforce boolean;
  v_age_status text;
  v_is_staff boolean;
  v_banned_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Temporary ban blocks everyone including staff (safety)
  SELECT banned_until INTO v_banned_until
    FROM public.profiles
   WHERE id = v_uid;
  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
    RAISE EXCEPTION 'account_temporarily_banned' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = v_uid
       AND role IN ('super_admin','admin','moderator')
  ) INTO v_is_staff;
  IF v_is_staff THEN RETURN; END IF;

  SELECT COALESCE(enabled, true) INTO v_age_enforce
    FROM public.feature_flags
   WHERE key = 'age_verification';
  IF v_age_enforce IS NULL THEN v_age_enforce := true; END IF;

  IF v_age_enforce THEN
    SELECT age_status::text INTO v_age_status
      FROM public.profiles
     WHERE id = v_uid;
    IF v_age_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_account_usable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_account_usable() TO authenticated, service_role;