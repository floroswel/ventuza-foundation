
CREATE OR REPLACE FUNCTION public.wipe_seed_admin_appendonly()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit int := 0;
  v_sens  int := 0;
BEGIN
  -- Bypass append-only triggers ONLY for seed-marked rows.
  SET LOCAL session_replication_role = 'replica';

  DELETE FROM public.admin_audit_log
   WHERE actor_email = 'seed@ventuza.local';
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  DELETE FROM public.admin_sensitive_access_log
   WHERE justification LIKE '[SEED]%';
  GET DIAGNOSTICS v_sens = ROW_COUNT;

  RETURN jsonb_build_object('audit', v_audit, 'sensitive', v_sens);
END;
$$;

REVOKE ALL ON FUNCTION public.wipe_seed_admin_appendonly() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_seed_admin_appendonly() TO service_role;
