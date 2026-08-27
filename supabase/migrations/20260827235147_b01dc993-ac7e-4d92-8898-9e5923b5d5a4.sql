DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname IN (
        'award_xp','notify_user','rl_enforce','safe_message_row',
        'compute_user_risk','recompute_risk_score','recompute_user_risk',
        'seed_content_summary','increment_quest_progress','discover_recent_call_count',
        'verification_decide_invariants_snapshot','verification_generate_challenges'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;