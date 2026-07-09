-- Fix: SECURITY DEFINER functions with EXECUTE granted to anon.
-- Trei bucket-uri: service_role only / authenticated only / anon + authenticated.

-- === BUCKET 1: service_role only (admin + joburi de fundal + webhooks) ===
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'admin_apply_strike(uuid, text, text, integer)',
    'admin_assign_alert(bigint, uuid, timestamp with time zone)',
    'admin_assign_moderator(text, uuid, uuid)',
    'admin_grant_badge(uuid, text, timestamp with time zone, text)',
    'admin_reveal_profile_location(uuid)',
    'admin_revoke_badge(uuid, text, text)',
    'admin_send_official_message(uuid, text, text)',
    'admin_set_legal_hold(uuid, boolean, text)',
    'admin_set_temporary_ban(uuid, timestamp with time zone, text)',
    'didit_apply_result(text, text, text, integer, jsonb)',
    'sync_age_status_from_verification()',
    'reset_stale_age_verification(uuid)',
    'reset_stale_age_verifications_batch()',
    'security_invariants_snapshot()',
    'sync_partner_announcements_consent()',
    'verification_decide_invariants_snapshot()',
    'verification_list_purgeable_paths()',
    'verification_mark_purged(uuid[])',
    'tg_notify_new_like()',
    'enqueue_email(text, jsonb)',
    'delete_email(text, bigint)',
    'read_email_batch(text, integer, integer)',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'move_to_dlq(text, text, bigint, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: %', fn;
    END;
  END LOOP;
END $$;

-- === BUCKET 2: authenticated only (RPC-uri user-side) ===
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'assert_verification_or_limited()',
    'is_verification_staff(uuid)',
    'record_consent(text, text, boolean, text)',
    'get_active_strikes(uuid)',
    'get_user_badges(uuid)',
    'get_user_badges_batch(uuid[])',
    'get_venue_badges(uuid)',
    'get_venue_badges_batch(uuid[])',
    'get_message_location_bucket(uuid)',
    'is_profile_publicly_visible(uuid, uuid)',
    'safe_message_row(uuid)',
    'send_location_message(uuid, double precision, double precision, text)',
    'update_live_location_message(uuid, double precision, double precision)',
    'verification_generate_challenges()',
    'verification_moderator_claim()',
    'verification_moderator_decide(uuid, text, text, text, text)',
    'verification_moderator_take(uuid)',
    'verification_submit_request(jsonb, text[], text, text, text)',
    'didit_link_session(text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: %', fn;
    END;
  END LOOP;
END $$;

-- === BUCKET 3: anon LEGITIM (chemate ÎNAINTE de login) ===
-- get_country_risk : apelat din useCountryRisk la boot (CountryRiskGuard),
--                    inclusiv pe /auth și /blocked-region.
-- app_role_values  : returnează doar enum values (metadata publică, safe).
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'get_country_risk(text)',
    'app_role_values()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: %', fn;
    END;
  END LOOP;
END $$;