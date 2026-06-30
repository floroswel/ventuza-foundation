
-- 1. referral_codes: drop public read; allow only authenticated
DROP POLICY IF EXISTS "rc_public_read" ON public.referral_codes;
CREATE POLICY "rc_authenticated_read" ON public.referral_codes
  FOR SELECT TO authenticated USING (true);

-- 2. business_applications: require auth for insert
DROP POLICY IF EXISTS "Anyone can submit business application" ON public.business_applications;
CREATE POLICY "Authenticated users can submit business application"
  ON public.business_applications
  FOR INSERT TO authenticated
  WITH CHECK (accepts_terms = true AND accepts_dpa = true AND accepts_lgbt_charter = true);

-- 3. Tighten always-true INSERT policies
DROP POLICY IF EXISTS "ee_insert" ON public.experiment_events;
CREATE POLICY "ee_insert" ON public.experiment_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "wv_insert" ON public.web_vitals;
CREATE POLICY "wv_insert" ON public.web_vitals
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 4. Fix mutable search_path on our helper
ALTER FUNCTION public.consent_kinds() SET search_path = public;

-- 5. Revoke EXECUTE on trigger functions (only called by trigger system as owner)
REVOKE EXECUTE ON FUNCTION public.cascade_health_consent_withdrawal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_health_consent_on_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_min_age() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_owner_no_self_publish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.offers_no_self_publish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_share_album_on_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user_fingerprints() FROM PUBLIC, anon, authenticated;

-- 6. Cron / service-role only
REVOKE EXECUTE ON FUNCTION public.billing_tick() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_scheduled_deletions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_inactive_for_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sos_purge_old_coords() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_create_invoice(uuid, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_ensure_free_sub() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- 7. Anon revoke for helper / RPC functions that require an authenticated user anyway
REVOKE EXECUTE ON FUNCTION public.app_role_values() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assert_account_usable() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assert_age_verified() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_age_verified() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_consent(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_health_consent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.health_gated_columns() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_active_entitlements(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_can_send_notification(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_get_quota_usage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.discover_profiles(integer, integer, integer, text[], text[], text[], text[], text[], text[], text[], integer, integer, boolean, boolean, boolean, text, integer, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_referral(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_consent(text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_health_consent(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nearby_points(text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_record_proximity_hit(text, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.offer_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_content_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_business_application_by_code(uuid) FROM PUBLIC, anon;
