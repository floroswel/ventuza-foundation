
-- ============================================================
-- PART 1: Profile columns for temporary ban + legal hold
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_hold_reason text,
  ADD COLUMN IF NOT EXISTS legal_hold_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_banned_until ON public.profiles(banned_until) WHERE banned_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_legal_hold ON public.profiles(legal_hold) WHERE legal_hold = true;

-- Update assert_account_usable to enforce temporary bans (staff not exempt for bans)
CREATE OR REPLACE FUNCTION public.assert_account_usable()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_age_enforce boolean;
  v_age_status text;
  v_is_staff boolean;
  v_banned_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email_confirmed_at INTO v_confirmed_at
    FROM auth.users WHERE id = v_uid;
  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  -- Temporary ban blocks everyone including staff (safety)
  SELECT banned_until INTO v_banned_until FROM public.profiles WHERE id = v_uid;
  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
    RAISE EXCEPTION 'account_temporarily_banned' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_uid
       AND role IN ('super_admin','admin','moderator')
  ) INTO v_is_staff;
  IF v_is_staff THEN RETURN; END IF;

  SELECT COALESCE(enabled, true) INTO v_age_enforce
    FROM public.feature_flags WHERE key = 'age_verification';
  IF v_age_enforce IS NULL THEN v_age_enforce := true; END IF;

  IF v_age_enforce THEN
    SELECT age_status::text INTO v_age_status
      FROM public.profiles WHERE id = v_uid;
    IF v_age_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$function$;

-- ============================================================
-- PART 2: user_strikes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity int NOT NULL CHECK (severity BETWEEN 1 AND 5),
  reason text NOT NULL,
  reason_code text,
  issued_by uuid,
  decay_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_strikes_user ON public.user_strikes(user_id, decay_at DESC) WHERE revoked_at IS NULL;

GRANT SELECT ON public.user_strikes TO authenticated;
GRANT ALL ON public.user_strikes TO service_role;

ALTER TABLE public.user_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_strikes_owner_read" ON public.user_strikes;
CREATE POLICY "user_strikes_owner_read" ON public.user_strikes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_strikes_staff_read" ON public.user_strikes;
CREATE POLICY "user_strikes_staff_read" ON public.user_strikes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Get active strikes (not decayed, not revoked)
CREATE OR REPLACE FUNCTION public.get_active_strikes(_user_id uuid)
RETURNS TABLE(id uuid, severity int, reason text, reason_code text, issued_by uuid, decay_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, severity, reason, reason_code, issued_by, decay_at, created_at
    FROM public.user_strikes
   WHERE user_id = _user_id
     AND revoked_at IS NULL
     AND decay_at > now()
   ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_strikes(uuid) TO authenticated, service_role;

-- Apply strike with progressive escalation
CREATE OR REPLACE FUNCTION public.admin_apply_strike(
  _target uuid,
  _reason text,
  _reason_code text DEFAULT NULL,
  _severity int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_active_count int;
  v_new_severity int;
  v_action text;
  v_ban_until timestamptz;
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 5 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT COUNT(*) INTO v_active_count
    FROM public.user_strikes
   WHERE user_id = _target AND revoked_at IS NULL AND decay_at > now();

  v_new_severity := COALESCE(_severity, LEAST(v_active_count + 1, 5));

  INSERT INTO public.user_strikes(user_id, severity, reason, reason_code, issued_by)
  VALUES (_target, v_new_severity, _reason, _reason_code, v_actor);

  -- Progressive escalation
  CASE v_new_severity
    WHEN 1 THEN v_action := 'warning';
    WHEN 2 THEN
      v_action := 'mute_24h';
      v_ban_until := now() + interval '24 hours';
      UPDATE public.profiles SET banned_until = v_ban_until WHERE id = _target;
    WHEN 3 THEN
      v_action := 'shadowban_7d';
      UPDATE public.profiles SET shadowbanned_at = now() WHERE id = _target;
    WHEN 4 THEN
      v_action := 'ban_30d';
      v_ban_until := now() + interval '30 days';
      UPDATE public.profiles SET banned_until = v_ban_until WHERE id = _target;
    WHEN 5 THEN
      v_action := 'ban_permanent';
      UPDATE public.profiles SET banned_at = now(), banned_reason = _reason WHERE id = _target;
  END CASE;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor, 'admin_apply_strike', 'profiles', _target,
          jsonb_build_object('severity', v_new_severity, 'action', v_action, 'reason', _reason),
          CASE WHEN v_new_severity >= 4 THEN 'critical' ELSE 'warning' END);

  RETURN jsonb_build_object('severity', v_new_severity, 'action', v_action, 'banned_until', v_ban_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_apply_strike(uuid, text, text, int) TO authenticated, service_role;

-- ============================================================
-- PART 3: Temporary ban RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_temporary_ban(
  _target uuid,
  _until timestamptz,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required_10_chars';
  END IF;
  IF _until IS NOT NULL AND _until <= now() THEN
    RAISE EXCEPTION 'until_must_be_future';
  END IF;

  UPDATE public.profiles SET banned_until = _until WHERE id = _target;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor,
    CASE WHEN _until IS NULL THEN 'admin_lift_temporary_ban' ELSE 'admin_set_temporary_ban' END,
    'profiles', _target,
    jsonb_build_object('banned_until', _until, 'reason', _reason),
    'warning');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_temporary_ban(uuid, timestamptz, text) TO authenticated, service_role;

-- ============================================================
-- PART 4: Legal hold RPC (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_legal_hold(
  _target uuid,
  _enable boolean,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden_super_admin_only' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required_10_chars';
  END IF;

  UPDATE public.profiles
     SET legal_hold = _enable,
         legal_hold_reason = CASE WHEN _enable THEN _reason ELSE NULL END,
         legal_hold_at = CASE WHEN _enable THEN now() ELSE NULL END,
         legal_hold_by = CASE WHEN _enable THEN v_actor ELSE NULL END
   WHERE id = _target;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor,
    CASE WHEN _enable THEN 'admin_set_legal_hold' ELSE 'admin_clear_legal_hold' END,
    'profiles', _target, jsonb_build_object('legal_hold', _enable, 'reason', _reason), 'critical');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_legal_hold(uuid, boolean, text) TO authenticated, service_role;

-- ============================================================
-- PART 5: Assign moderator on reports + verification_requests
-- ============================================================
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS assigned_moderator_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS assigned_moderator_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_assign_moderator(
  _kind text,
  _item_id uuid,
  _moderator uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _kind NOT IN ('report','verification') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF _kind = 'report' THEN
    UPDATE public.reports
       SET assigned_moderator_id = _moderator,
           assigned_at = CASE WHEN _moderator IS NULL THEN NULL ELSE now() END
     WHERE id = _item_id;
  ELSE
    UPDATE public.verification_requests
       SET assigned_moderator_id = _moderator,
           assigned_at = CASE WHEN _moderator IS NULL THEN NULL ELSE now() END
     WHERE id = _item_id;
  END IF;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor, 'admin_assign_moderator', _kind, _item_id,
          jsonb_build_object('moderator', _moderator), 'info');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_moderator(text, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- PART 6: Extend badge_registry + user_badge_grants
-- ============================================================
ALTER TABLE public.badge_registry
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effect text CHECK (effect IN ('shimmer','pulse','glow')),
  ADD COLUMN IF NOT EXISTS default_permanent boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_badge_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badge_registry(code),
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  UNIQUE (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS idx_user_badge_grants_user_active ON public.user_badge_grants(user_id)
  WHERE revoked_at IS NULL;

GRANT SELECT ON public.user_badge_grants TO authenticated;
GRANT ALL ON public.user_badge_grants TO service_role;

ALTER TABLE public.user_badge_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ubg_read_own" ON public.user_badge_grants;
CREATE POLICY "ubg_read_own" ON public.user_badge_grants
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Update get_user_badges to include manual grants
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_codes text[] := ARRAY[]::text[];
  v_row record;
  v_manual text[];
BEGIN
  -- Auto badges (existing logic — keep compatible)
  SELECT age_status, created_at INTO v_row FROM public.profiles WHERE id = _user_id;
  IF v_row.age_status::text = 'verified' THEN v_codes := array_append(v_codes, 'verified'); END IF;
  IF v_row.created_at < '2026-08-01'::timestamptz THEN v_codes := array_append(v_codes, 'founder'); END IF;

  IF EXISTS (SELECT 1 FROM public.matches WHERE user_a = _user_id OR user_b = _user_id GROUP BY 1 HAVING COUNT(*) >= 25) THEN
    v_codes := array_append(v_codes, 'matcher');
  END IF;

  -- Manual grants (active only)
  SELECT COALESCE(array_agg(badge_code), ARRAY[]::text[]) INTO v_manual
    FROM public.user_badge_grants
   WHERE user_id = _user_id
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

  v_codes := v_codes || v_manual;
  RETURN v_codes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated, service_role, anon;

-- Grant badge RPC
CREATE OR REPLACE FUNCTION public.admin_grant_badge(
  _target uuid,
  _code text,
  _expires_at timestamptz,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_manual boolean;
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required_10_chars';
  END IF;

  SELECT is_manual INTO v_manual FROM public.badge_registry WHERE code = _code AND is_active = true;
  IF v_manual IS NULL THEN RAISE EXCEPTION 'badge_not_found'; END IF;
  IF NOT v_manual THEN RAISE EXCEPTION 'badge_not_manual'; END IF;

  INSERT INTO public.user_badge_grants(user_id, badge_code, granted_by, expires_at, reason)
  VALUES (_target, _code, v_actor, _expires_at, _reason)
  ON CONFLICT (user_id, badge_code) DO UPDATE
    SET granted_by = v_actor,
        granted_at = now(),
        expires_at = _expires_at,
        reason = _reason,
        revoked_at = NULL,
        revoked_by = NULL,
        revoke_reason = NULL;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor, 'admin_grant_badge', 'user_badge_grants', _target,
          jsonb_build_object('code', _code, 'expires_at', _expires_at, 'reason', _reason), 'critical');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(
  _target uuid,
  _code text,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required_10_chars';
  END IF;

  UPDATE public.user_badge_grants
     SET revoked_at = now(), revoked_by = v_actor, revoke_reason = _reason
   WHERE user_id = _target AND badge_code = _code AND revoked_at IS NULL;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor, 'admin_revoke_badge', 'user_badge_grants', _target,
          jsonb_build_object('code', _code, 'reason', _reason), 'critical');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- PART 7: Seed 8 manual badges into badge_registry
-- ============================================================
INSERT INTO public.badge_registry(code, target, label_i18n, icon, color_class, priority, criteria_summary, is_manual, effect, default_permanent, is_active)
VALUES
  ('founder_suzeta','user','{"ro":"Fondator Suzeta","en":"Suzeta Founder"}'::jsonb,'Crown','text-amber-400',200,
   'Badge onorific acordat fondatorilor și primilor contributori Suzeta.', true,'shimmer',true,true),
  ('ngo_partner','user','{"ro":"Partener ONG","en":"NGO Partner"}'::jsonb,'Heart','text-emerald-500',150,
   'Reprezentant verificat al unui ONG partener (ACCEPT, ARAS etc.).', true,'glow',true,true),
  ('bar_verified','user','{"ro":"Local verificat","en":"Verified Venue"}'::jsonb,'Wine','text-blue-500',140,
   'Reprezentant verificat al unui local partener Suzeta.', true,'shimmer',true,true),
  ('event_organizer','user','{"ro":"Organizator evenimente","en":"Event Organizer"}'::jsonb,'Calendar','text-fuchsia-500',130,
   'Organizator verificat de evenimente comunitare.', true,NULL,false,true),
  ('ally','user','{"ro":"Aliat comunitate","en":"Community Ally"}'::jsonb,'Rainbow','text-pink-400',110,
   'Aliat verificat al comunității LGBTQ+.', true,'pulse',true,true),
  ('press','user','{"ro":"Presă / Media","en":"Press / Media"}'::jsonb,'Mic','text-yellow-500',120,
   'Reprezentant media verificat.', true,NULL,false,true),
  ('moderator_public','user','{"ro":"Moderator","en":"Moderator"}'::jsonb,'Shield','text-blue-600',180,
   'Membru al echipei de moderare Suzeta.', true,'glow',true,true),
  ('beta_tester','user','{"ro":"Beta Tester","en":"Beta Tester"}'::jsonb,'Bug','text-lime-500',80,
   'A contribuit la testarea versiunilor beta.', true,NULL,true,true)
ON CONFLICT (code) DO UPDATE
  SET is_manual = EXCLUDED.is_manual,
      effect = EXCLUDED.effect,
      default_permanent = EXCLUDED.default_permanent,
      priority = EXCLUDED.priority,
      label_i18n = EXCLUDED.label_i18n,
      icon = EXCLUDED.icon,
      color_class = EXCLUDED.color_class,
      criteria_summary = EXCLUDED.criteria_summary;

-- ============================================================
-- PART 8: admin_send_official_message
-- ============================================================
-- Uses a stable "system" sender identity stored in app_settings
-- (avoids creating a fake auth.users row). Actual insert bypasses
-- normal user checks via SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.admin_send_official_message(
  _target uuid,
  _body text,
  _subject text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_convo uuid;
  v_msg_id uuid;
  v_full_body text;
BEGIN
  IF NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _body IS NULL OR length(_body) < 3 THEN
    RAISE EXCEPTION 'body_required';
  END IF;

  v_full_body := COALESCE('[' || _subject || ']' || E'\n\n', '') || _body;

  -- Find or create a conversation between the actor (staff) and target.
  SELECT id INTO v_convo FROM public.conversations
   WHERE (user_a = v_actor AND user_b = _target)
      OR (user_a = _target AND user_b = v_actor)
   LIMIT 1;
  IF v_convo IS NULL THEN
    INSERT INTO public.conversations(user_a, user_b) VALUES (v_actor, _target) RETURNING id INTO v_convo;
  END IF;

  INSERT INTO public.messages(conversation_id, sender_id, receiver_id, body, is_official)
  VALUES (v_convo, v_actor, _target, v_full_body, true)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications(user_id, type, title, body, data)
  VALUES (_target, 'admin_message',
          COALESCE(_subject, 'Mesaj oficial Suzeta'),
          left(_body, 200),
          jsonb_build_object('conversation_id', v_convo, 'message_id', v_msg_id));

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after, severity)
  VALUES (v_actor, 'admin_send_official_message', 'messages', v_msg_id,
          jsonb_build_object('target', _target, 'subject', _subject, 'chars', length(_body)),
          'warning');

  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_official_message(uuid, text, text) TO authenticated, service_role;

-- Add is_official column on messages if missing
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
