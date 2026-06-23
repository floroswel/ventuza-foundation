
ALTER FUNCTION public.compute_profile_completion(public.profiles) SET search_path = public;
ALTER FUNCTION public.tg_update_profile_completion() SET search_path = public;

DROP POLICY IF EXISTS ad_events_anyone_insert ON public.ad_events;
CREATE POLICY ad_events_auth_insert ON public.ad_events
  FOR INSERT TO authenticated WITH CHECK (true);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'admin_risk_queue','ban_user_fingerprints','moderator_ban_user',
        'moderator_suspend_user','moderator_verify_user','moderator_warn_user',
        'recompute_risk_score','notify_user','set_looking_now',
        'update_my_location','mark_message_viewed','unsend_message',
        'toggle_message_reaction','get_or_create_conversation',
        'register_device_fingerprint','handle_swipe','validate_profile_text',
        'has_active_subscription','is_conversation_participant','is_group_member',
        'grant_business_role_on_approval'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
  END LOOP;
END $$;
