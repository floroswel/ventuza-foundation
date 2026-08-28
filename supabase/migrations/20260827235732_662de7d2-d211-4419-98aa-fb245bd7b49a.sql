-- 1) admin_mfa_status: no client-writable enrollment
DROP POLICY IF EXISTS "Users insert own mfa" ON public.admin_mfa_status;
DROP POLICY IF EXISTS "Users update own mfa" ON public.admin_mfa_status;
REVOKE INSERT, UPDATE, DELETE ON public.admin_mfa_status FROM authenticated, anon;
GRANT SELECT ON public.admin_mfa_status TO authenticated;
GRANT ALL ON public.admin_mfa_status TO service_role;

CREATE OR REPLACE FUNCTION public.admin_sync_my_mfa()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _verified boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
     WHERE f.user_id = _uid AND f.status = 'verified'
  ) INTO _verified;

  INSERT INTO public.admin_mfa_status (user_id, enrolled, enrolled_at, updated_at)
  VALUES (_uid, _verified, CASE WHEN _verified THEN now() ELSE NULL END, now())
  ON CONFLICT (user_id) DO UPDATE
    SET enrolled = EXCLUDED.enrolled,
        enrolled_at = CASE WHEN EXCLUDED.enrolled
                           THEN COALESCE(public.admin_mfa_status.enrolled_at, now())
                           ELSE NULL END,
        updated_at = now();

  RETURN _verified;
END $$;

REVOKE ALL ON FUNCTION public.admin_sync_my_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_my_mfa() TO authenticated, service_role;

-- 2) photo_hashes: writes only through record_photo_hash / service role
DROP POLICY IF EXISTS "insert own photo hash" ON public.photo_hashes;
DROP POLICY IF EXISTS "delete own photo hash" ON public.photo_hashes;
REVOKE INSERT, UPDATE, DELETE ON public.photo_hashes FROM authenticated, anon;
GRANT SELECT ON public.photo_hashes TO authenticated;
GRANT ALL ON public.photo_hashes TO service_role;