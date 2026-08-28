-- =============================================================================
-- FIX 1 — Escaladare de privilegii pe profiles: triggerul acoperă și INSERT
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                        OR (current_user IN ('service_role','postgres','supabase_admin'));
BEGIN
  IF is_service THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un profil nou creat de client pornește ÎNTOTDEAUNA de la zero.
    NEW.verified                 := false;
    NEW.verified_at              := NULL;
    NEW.age_verified_at          := NULL;
    NEW.age_status               := 'unverified'::public.age_status;
    NEW.age_provider             := NULL;
    NEW.verification_status      := 'unverified';
    NEW.verification_reason      := NULL;
    NEW.verification_selfie_path := NULL;
    NEW.banned_at                := NULL;
    NEW.banned_until             := NULL;
    NEW.banned_reason            := NULL;
    NEW.suspended_until          := NULL;
    NEW.suspended_reason         := NULL;
    NEW.warned_at                := NULL;
    NEW.warned_reason            := NULL;
    NEW.report_count             := 0;
    NEW.risk_score               := 0;
    NEW.risk_signals             := '{}'::jsonb;
    NEW.risk_updated_at          := NULL;
    NEW.boost_until              := NULL;
    NEW.boosts_balance           := 0;
    NEW.super_taps_balance       := 3;
    NEW.xp                       := 0;
    NEW.level                    := 1;
    NEW.streak_days              := 0;
    NEW.partner_suspended_at     := NULL;
    NEW.deleted_at               := NULL;
    NEW.is_seed                  := false;
    RETURN NEW;
  END IF;

  IF NEW.verified                  IS DISTINCT FROM OLD.verified                  THEN NEW.verified                  := OLD.verified;                  END IF;
  IF NEW.verified_at               IS DISTINCT FROM OLD.verified_at               THEN NEW.verified_at               := OLD.verified_at;               END IF;
  IF NEW.age_verified_at           IS DISTINCT FROM OLD.age_verified_at           THEN NEW.age_verified_at           := OLD.age_verified_at;           END IF;
  IF NEW.age_status                IS DISTINCT FROM OLD.age_status                THEN NEW.age_status                := OLD.age_status;                END IF;
  IF NEW.age_provider              IS DISTINCT FROM OLD.age_provider              THEN NEW.age_provider              := OLD.age_provider;              END IF;
  IF NEW.verification_status       IS DISTINCT FROM OLD.verification_status       THEN NEW.verification_status       := OLD.verification_status;       END IF;
  IF NEW.verification_reason       IS DISTINCT FROM OLD.verification_reason       THEN NEW.verification_reason       := OLD.verification_reason;       END IF;
  IF NEW.verification_selfie_path  IS DISTINCT FROM OLD.verification_selfie_path  THEN NEW.verification_selfie_path  := OLD.verification_selfie_path;  END IF;
  IF NEW.banned_at                 IS DISTINCT FROM OLD.banned_at                 THEN NEW.banned_at                 := OLD.banned_at;                 END IF;
  IF NEW.banned_until              IS DISTINCT FROM OLD.banned_until              THEN NEW.banned_until              := OLD.banned_until;              END IF;
  IF NEW.banned_reason             IS DISTINCT FROM OLD.banned_reason             THEN NEW.banned_reason             := OLD.banned_reason;             END IF;
  IF NEW.suspended_until           IS DISTINCT FROM OLD.suspended_until           THEN NEW.suspended_until           := OLD.suspended_until;           END IF;
  IF NEW.suspended_reason          IS DISTINCT FROM OLD.suspended_reason          THEN NEW.suspended_reason          := OLD.suspended_reason;          END IF;
  IF NEW.warned_at                 IS DISTINCT FROM OLD.warned_at                 THEN NEW.warned_at                 := OLD.warned_at;                 END IF;
  IF NEW.warned_reason             IS DISTINCT FROM OLD.warned_reason             THEN NEW.warned_reason             := OLD.warned_reason;             END IF;
  IF NEW.report_count              IS DISTINCT FROM OLD.report_count              THEN NEW.report_count              := OLD.report_count;              END IF;
  IF NEW.risk_score                IS DISTINCT FROM OLD.risk_score                THEN NEW.risk_score                := OLD.risk_score;                END IF;
  IF NEW.risk_signals              IS DISTINCT FROM OLD.risk_signals              THEN NEW.risk_signals              := OLD.risk_signals;              END IF;
  IF NEW.risk_updated_at           IS DISTINCT FROM OLD.risk_updated_at           THEN NEW.risk_updated_at           := OLD.risk_updated_at;           END IF;
  IF NEW.boost_until               IS DISTINCT FROM OLD.boost_until               THEN NEW.boost_until               := OLD.boost_until;               END IF;
  IF NEW.boosts_balance            IS DISTINCT FROM OLD.boosts_balance            THEN NEW.boosts_balance            := OLD.boosts_balance;            END IF;
  IF NEW.super_taps_balance        IS DISTINCT FROM OLD.super_taps_balance        THEN NEW.super_taps_balance        := OLD.super_taps_balance;        END IF;
  IF NEW.xp                        IS DISTINCT FROM OLD.xp                        THEN NEW.xp                        := OLD.xp;                        END IF;
  IF NEW.level                     IS DISTINCT FROM OLD.level                     THEN NEW.level                     := OLD.level;                     END IF;
  IF NEW.streak_days               IS DISTINCT FROM OLD.streak_days               THEN NEW.streak_days               := OLD.streak_days;               END IF;
  IF NEW.partner_suspended_at      IS DISTINCT FROM OLD.partner_suspended_at      THEN NEW.partner_suspended_at      := OLD.partner_suspended_at;      END IF;
  IF NEW.is_seed                   IS DISTINCT FROM OLD.is_seed                   THEN NEW.is_seed                   := OLD.is_seed;                   END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Reset-by-reinsertion: fără DELETE direct din client. Ștergerea contului trece
-- prin fluxul GDPR (deletion_requests + adminProcessDeletion, service_role).
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
REVOKE DELETE ON public.profiles FROM authenticated;

-- Defense-in-depth: anon nu are ce citi din profiles (nicio politică TO anon),
-- dar grantul rămas ar transforma orice viitoare politică fără TO în breșă publică.
REVOKE SELECT ON public.profiles FROM anon;

-- =============================================================================
-- FIX 2 — assert_account_usable: email confirmat redevine obligatoriu
-- =============================================================================
CREATE OR REPLACE FUNCTION public.assert_account_usable()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_age_enforce boolean;
  v_age_status text;
  v_is_staff boolean;
  v_banned_until timestamptz;
  v_banned_at timestamptz;
  v_deleted_at timestamptz;
  v_email_confirmed timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT banned_until, banned_at, deleted_at
    INTO v_banned_until, v_banned_at, v_deleted_at
    FROM public.profiles
   WHERE id = v_uid;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'account_deleted' USING ERRCODE = '42501';
  END IF;
  IF v_banned_at IS NOT NULL THEN
    RAISE EXCEPTION 'account_banned' USING ERRCODE = '42501';
  END IF;
  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
    RAISE EXCEPTION 'account_temporarily_banned' USING ERRCODE = '42501';
  END IF;

  -- Confirmarea emailului se aplică TUTUROR, inclusiv staff.
  SELECT email_confirmed_at INTO v_email_confirmed
    FROM auth.users WHERE id = v_uid;
  IF v_email_confirmed IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_uid
       AND role IN ('super_admin','admin','moderator')
  ) INTO v_is_staff;
  -- Staff-ul rămâne exceptat DOAR de la age gate (operare panou moderare),
  -- niciodată de la ban / ștergere / email neconfirmat.
  IF v_is_staff THEN RETURN; END IF;

  SELECT COALESCE(enabled, true) INTO v_age_enforce
    FROM public.feature_flags
   WHERE key = 'age_verification';
  IF v_age_enforce IS NULL THEN v_age_enforce := true; END IF;

  IF v_age_enforce THEN
    SELECT age_status::text INTO v_age_status
      FROM public.profiles
     WHERE id = v_uid;
    IF v_age_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$function$;

-- =============================================================================
-- FIX 3 — get_public_profiles: blocări + hide_age + an-only + plafon
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text, discreet_avatar text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  PERFORM public.assert_age_verified();

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RETURN; END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN (p.incognito IS TRUE OR p.hide_online IS TRUE) AND p.id <> v_me
         THEN NULL ELSE p.last_seen END,
    -- Niciodată data exactă: doar anul, și nimic dacă userul a ascuns vârsta.
    CASE
      WHEN p.id = v_me THEN p.birthdate
      WHEN p.hide_age IS TRUE THEN NULL
      WHEN p.birthdate IS NULL THEN NULL
      ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::int, 1, 1)
    END,
    p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> v_me THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug, p.discreet_avatar
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND (
      p.id = v_me
      OR NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = v_me AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_me)
      )
    );
END;
$function$;

-- =============================================================================
-- FIX 4 — list_visible_profiles: an-only + hide_age + plafon
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_visible_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  PERFORM public.assert_age_verified();

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RETURN; END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN (p.incognito IS TRUE OR p.hide_online IS TRUE) AND p.id <> v_me
         THEN NULL ELSE p.last_seen END,
    CASE
      WHEN p.id = v_me THEN p.birthdate
      WHEN p.hide_age IS TRUE THEN NULL
      WHEN p.birthdate IS NULL THEN NULL
      ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::int, 1, 1)
    END,
    p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> v_me THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_me AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_me)
    )
    AND (
      p.incognito IS NOT TRUE
      OR p.id = v_me
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = v_me AND c.user_b = p.id)
           OR (c.user_b = v_me AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = v_me AND m.user_b = p.id)
           OR (m.user_b = v_me AND m.user_a = p.id)
      )
    );
END;
$function$;

-- =============================================================================
-- FIX 5 — cale dedicată pentru ecranul „Utilizatori blocați"
-- (get_public_profiles filtrează acum blocările, deci lista are nevoie de RPC propriu)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_my_blocked_profiles()
RETURNS TABLE(blocked_id uuid, created_at timestamp with time zone, display_name text, photos text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT b.blocked_id,
         b.created_at,
         p.display_name,
         -- doar prima poză, strict pentru identificare vizuală în listă
         CASE WHEN p.photos IS NULL OR array_length(p.photos,1) IS NULL
              THEN NULL::text[] ELSE p.photos[1:1] END
    FROM public.blocks b
    LEFT JOIN public.profiles p ON p.id = b.blocked_id
   WHERE b.blocker_id = v_me
   ORDER BY b.created_at DESC
   LIMIT 500;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_blocked_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_blocked_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_blocked_profiles() TO service_role;

-- =============================================================================
-- FIX 6 — RPC-uri de economie / metadate: gate de cont valid
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  last_date date;
  today date := (now() AT TIME ZONE 'UTC')::date;
  cur_streak integer;
  next_streak integer;
  reward_kind text;
  reward_amount integer;
  xp_reward integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_account_usable();

  IF EXISTS (SELECT 1 FROM public.daily_rewards WHERE user_id = uid AND claimed_on = today) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  SELECT (last_check_in_at AT TIME ZONE 'UTC')::date, streak_days
    INTO last_date, cur_streak
    FROM public.profiles WHERE id = uid;

  cur_streak := COALESCE(cur_streak, 0);

  IF last_date IS NULL OR last_date < today - INTERVAL '1 day' THEN
    next_streak := 1;
  ELSIF last_date = today - INTERVAL '1 day' THEN
    next_streak := cur_streak + 1;
  ELSE
    next_streak := GREATEST(cur_streak, 1);
  END IF;

  CASE ((next_streak - 1) % 7) + 1
    WHEN 1 THEN reward_kind := 'super_taps'; reward_amount := 1; xp_reward := 20;
    WHEN 2 THEN reward_kind := 'xp';         reward_amount := 0; xp_reward := 40;
    WHEN 3 THEN reward_kind := 'super_taps'; reward_amount := 2; xp_reward := 30;
    WHEN 4 THEN reward_kind := 'xp';         reward_amount := 0; xp_reward := 60;
    WHEN 5 THEN reward_kind := 'boost';      reward_amount := 1; xp_reward := 50;
    WHEN 6 THEN reward_kind := 'super_taps'; reward_amount := 3; xp_reward := 70;
    WHEN 7 THEN reward_kind := 'boost';      reward_amount := 2; xp_reward := 150;
  END CASE;

  INSERT INTO public.daily_rewards(user_id, claimed_on, streak_day, reward_kind, reward_amount, xp_awarded)
    VALUES (uid, today, next_streak, reward_kind, reward_amount, xp_reward);

  UPDATE public.profiles
     SET streak_days = next_streak,
         last_check_in_at = now(),
         boosts_balance = boosts_balance + CASE WHEN reward_kind = 'boost' THEN reward_amount ELSE 0 END,
         super_taps_balance = super_taps_balance + CASE WHEN reward_kind = 'super_taps' THEN reward_amount ELSE 0 END
   WHERE id = uid;

  PERFORM public.award_xp(uid, 'daily_checkin', xp_reward, jsonb_build_object('streak', next_streak));

  RETURN jsonb_build_object(
    'streak', next_streak,
    'reward_kind', reward_kind,
    'reward_amount', reward_amount,
    'xp', xp_reward
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_quest_reward(_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); wk date := public.current_week_start();
  uq record; tpl record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.assert_account_usable();

  SELECT * INTO uq FROM public.user_quests
   WHERE user_id = uid AND quest_id = _quest_id AND week_start = wk;
  IF NOT FOUND OR uq.completed_at IS NULL THEN RAISE EXCEPTION 'not_completed'; END IF;
  IF uq.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT * INTO tpl FROM public.quest_templates WHERE id = _quest_id;

  UPDATE public.user_quests SET claimed_at = now() WHERE id = uq.id;

  PERFORM public.award_xp(uid, 'quest:' || _quest_id, tpl.xp_reward, jsonb_build_object('quest', _quest_id));

  IF tpl.bonus_kind IS NOT NULL AND tpl.bonus_amount > 0 THEN
    UPDATE public.profiles
       SET boosts_balance = boosts_balance + CASE WHEN tpl.bonus_kind = 'boost' THEN tpl.bonus_amount ELSE 0 END,
           super_taps_balance = super_taps_balance + CASE WHEN tpl.bonus_kind = 'super_taps' THEN tpl.bonus_amount ELSE 0 END
     WHERE id = uid;
  END IF;

  RETURN jsonb_build_object('xp', tpl.xp_reward, 'bonus_kind', tpl.bonus_kind, 'bonus_amount', tpl.bonus_amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
  v_uid uuid := auth.uid();
  v_cfg jsonb;
  v_ref_cents int;
  v_new_cents int;
  v_today int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  perform public.assert_account_usable();

  select owner_id into v_owner from referral_codes where code = upper(trim(_code));
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if v_owner = v_uid then return jsonb_build_object('ok', false, 'error', 'self_referral'); end if;
  if exists (select 1 from referral_redemptions where referred_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  select value into v_cfg from app_settings where key='wallet_rewards';
  v_ref_cents := coalesce((v_cfg->>'referrer_cents')::int, 200);
  v_new_cents := coalesce((v_cfg->>'referred_cents')::int, 100);

  select count(*) into v_today from referral_redemptions
   where referrer_id = v_owner and created_at > now() - interval '1 day';
  if v_today >= coalesce((v_cfg->>'max_referrals_per_day')::int, 20) then
    return jsonb_build_object('ok', false, 'error', 'referrer_daily_limit');
  end if;

  insert into referral_redemptions(code, referrer_id, referred_id) values (upper(trim(_code)), v_owner, v_uid);
  update referral_codes set uses_count = uses_count + 1 where code = upper(trim(_code));
  update profiles set xp = coalesce(xp,0) + 100 where id in (v_owner, v_uid);

  perform public.wallet_credit(v_owner, v_ref_cents, 'referral_bonus', 'pending', v_uid, 'Invitatie acceptata');
  perform public.wallet_credit(v_uid, v_new_cents, 'referral_welcome', 'pending', v_uid, 'Bun venit prin invitatie');

  if exists (select 1 from profiles where id = v_uid and age_status = 'verified') then
    perform public.wallet_qualify_referral(v_uid);
  end if;

  return jsonb_build_object('ok', true, 'reward_xp', 100, 'wallet_cents', v_new_cents);
end $function$;

-- get_user_badges: gate de cont + respectă blocările (nu mai confirmă existența
-- / statutul unui profil pentru cineva care a fost blocat).
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_codes text[] := ARRAY[]::text[];
  v_row record;
  v_manual text[];
  v_me uuid := auth.uid();
BEGIN
  PERFORM public.assert_age_verified();

  IF _user_id IS DISTINCT FROM v_me
     AND EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = v_me AND b.blocked_id = _user_id)
          OR (b.blocker_id = _user_id AND b.blocked_id = v_me)
     )
  THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT age_status, created_at INTO v_row FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN ARRAY[]::text[]; END IF;

  IF v_row.age_status::text = 'verified' THEN v_codes := array_append(v_codes, 'verified'); END IF;
  IF v_row.created_at < '2026-08-01'::timestamptz THEN v_codes := array_append(v_codes, 'founder'); END IF;

  IF EXISTS (SELECT 1 FROM public.matches WHERE user_a = _user_id OR user_b = _user_id GROUP BY 1 HAVING COUNT(*) >= 25) THEN
    v_codes := array_append(v_codes, 'matcher');
  END IF;

  SELECT COALESCE(array_agg(badge_code), ARRAY[]::text[]) INTO v_manual
    FROM public.user_badge_grants
   WHERE user_id = _user_id
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

  v_codes := v_codes || v_manual;
  RETURN v_codes;
END;
$function$;

-- =============================================================================
-- FIX 7 — set_looking_now: elimină supraîncărcarea veche, fără age gate
-- (regula proiectului: nicio semnătură duplicată expusă în Data API)
-- =============================================================================
DROP FUNCTION IF EXISTS public.set_looking_now(integer, text);

CREATE OR REPLACE FUNCTION public.set_looking_now(_intent text, _hours integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); h integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.assert_age_verified();
  IF COALESCE(_hours, 0) <= 0 THEN
    UPDATE public.profiles
       SET looking_now_until = NULL, looking_now_intent = NULL
     WHERE id = me;
    RETURN;
  END IF;
  h := LEAST(GREATEST(_hours, 1), 12);
  UPDATE public.profiles
     SET looking_now_intent = NULLIF(left(COALESCE(_intent,''), 80), ''),
         looking_now_until = now() + (h || ' hours')::interval
   WHERE id = me;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_looking_now(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_looking_now(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_looking_now(text, integer) TO service_role;

-- Re-asigură grant-urile pentru funcțiile recreate (CREATE OR REPLACE păstrează
-- ACL-ul, dar fixăm explicit ca migrarea să fie idempotentă).
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_profiles(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_quest_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_quest_reward(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.redeem_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated, service_role;