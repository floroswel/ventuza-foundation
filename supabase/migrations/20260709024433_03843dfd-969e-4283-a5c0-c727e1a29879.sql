DO $$
DECLARE
  admin_fns text[] := ARRAY[
    'admin_apply_strike(uuid,text,text,integer)',
    'admin_assign_alert(bigint,uuid,timestamptz)',
    'admin_assign_moderator(text,uuid,uuid)',
    'admin_grant_badge(uuid,text,timestamptz,text)',
    'admin_reveal_profile_location(uuid)',
    'admin_revoke_badge(uuid,text,text)',
    'admin_send_official_message(uuid,text,text)',
    'admin_set_legal_hold(uuid,boolean,text)',
    'admin_set_temporary_ban(uuid,timestamptz,text)'
  ];
  service_only_fns text[] := ARRAY[
    'didit_apply_result(text,text,text,integer,jsonb)',
    'didit_link_session(text,text,text)',
    'sync_age_status_from_verification()',
    'reset_stale_age_verification(uuid)',
    'reset_stale_age_verifications_batch()',
    'enqueue_email(text,jsonb)',
    'delete_email(text,bigint)',
    'read_email_batch(text,integer,integer)',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'move_to_dlq(text,text,bigint,jsonb)'
  ];
  authed_fns text[] := ARRAY[
    'assert_verification_or_limited()',
    'is_verification_staff(uuid)',
    'verification_decide_invariants_snapshot()',
    'verification_generate_challenges()',
    'verification_list_purgeable_paths()',
    'verification_mark_purged(uuid[])',
    'verification_moderator_claim()',
    'verification_moderator_decide(uuid,text,text,text,text)',
    'verification_moderator_take(uuid)',
    'verification_submit_request(jsonb,text[],text,text,text)',
    'record_consent(text,text,boolean,text)',
    'get_active_strikes(uuid)',
    'get_user_badges(uuid)',
    'get_user_badges_batch(uuid[])',
    'get_venue_badges(uuid)',
    'get_venue_badges_batch(uuid[])',
    'get_message_location_bucket(uuid)',
    'is_profile_publicly_visible(uuid,uuid)',
    'safe_message_row(uuid)',
    'send_location_message(uuid,double precision,double precision,text)',
    'update_live_location_message(uuid,double precision,double precision)',
    'app_role_values()',
    'security_invariants_snapshot()',
    'sync_partner_announcements_consent()'
  ];
  trigger_fns text[] := ARRAY[
    'tg_notify_new_like()'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY admin_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated', fn);
  END LOOP;
  FOREACH fn IN ARRAY service_only_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY authed_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
  END LOOP;
END $$;