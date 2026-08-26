CREATE OR REPLACE FUNCTION public.security_invariants_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assert text;
  v_discover text;
  v_cleanup text;
  v_cfg jsonb;
  v_result jsonb;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_assert
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_account_usable' LIMIT 1;

  SELECT pg_get_functiondef(p.oid) INTO v_discover
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'discover_profiles' LIMIT 1;

  SELECT pg_get_functiondef(p.oid) INTO v_cleanup
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_rate_limit_log' LIMIT 1;

  SELECT value INTO v_cfg FROM public.app_settings WHERE key = 'discover_limits';

  v_result := jsonb_build_object(
    'assert_account_usable_present', v_assert IS NOT NULL,
    'assert_checks_email_confirmed', v_assert ILIKE '%email_confirmed_at%' AND v_assert ILIKE '%email_not_confirmed%',
    'assert_checks_age', v_assert ILIKE '%age_verification_required%',
    'discover_present', v_discover IS NOT NULL,
    'discover_calls_assert_account_usable', v_discover ILIKE '%assert_account_usable%',
    'discover_max_per_call_50', v_discover ILIKE '%constant int := 50%' OR v_discover ILIKE '%), 50)%',
    'discover_max_calls_per_hour', LEAST(GREATEST(COALESCE((v_cfg->>'max_calls_per_hour')::int, 60), 1), 60),
    'discover_limits_config_present', v_cfg IS NOT NULL,
    'discover_inserts_rate_limit_log', v_discover ILIKE '%rate_limit_log%' AND v_discover ILIKE '%discover_profiles%',
    'discover_raises_rate_limited', v_discover ILIKE '%discover_rate_limited%',
    -- Alias de compatibilitate (consumat de testele de invarianți și panoul admin):
    -- rate limit activ = se inserează în log ȘI se ridică excepția dedicată.
    'discover_rate_limit_present',
      (v_discover ILIKE '%rate_limit_log%' AND v_discover ILIKE '%discover_rate_limited%'),
    'cleanup_present', v_cleanup IS NOT NULL,
    'cleanup_retains_7_days', v_cleanup ILIKE '%7 days%' OR v_cleanup ILIKE '%interval ''7%'
  );

  RETURN v_result;
END;
$$;