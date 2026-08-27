DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.handle_swipe()',
    'public.trg_rl_swipe()',
    'public.grant_business_role_on_approval()',
    'public.verification_list_purgeable_paths()',
    'public.verification_mark_purged(uuid[])'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.verification_list_purgeable_paths() TO service_role;
GRANT EXECUTE ON FUNCTION public.verification_mark_purged(uuid[]) TO service_role;