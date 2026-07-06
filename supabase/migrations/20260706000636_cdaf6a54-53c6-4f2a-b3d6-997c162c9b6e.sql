GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO service_role;

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
    RAISE EXCEPTION 'age_verification_required'
      USING ERRCODE = '42501',
            DETAIL = COALESCE(v_status::text, 'missing_profile'),
            HINT = 'User must have profiles.age_status=verified to send messages.';
  END IF;
  RETURN NEW;
END;
$function$;