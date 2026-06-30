
-- =====================================================================
-- ANTI-BOT P1: real risk scoring + rate limits + disposable email block
-- =====================================================================

-- ---------- 1. DISPOSABLE EMAIL BLACKLIST ----------------------------
CREATE OR REPLACE FUNCTION public.is_disposable_email(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(split_part(_email, '@', 2)) = ANY(ARRAY[
    'mailinator.com','guerrillamail.com','guerrillamail.info','guerrillamail.biz',
    'guerrillamail.de','guerrillamail.net','guerrillamail.org','sharklasers.com',
    'grr.la','spam4.me','tempmail.com','tempmail.net','tempmailo.com','temp-mail.org',
    'temp-mail.io','10minutemail.com','10minutemail.net','20minutemail.com',
    'yopmail.com','yopmail.fr','yopmail.net','trashmail.com','trashmail.de',
    'trashmail.io','trashmail.net','throwawaymail.com','maildrop.cc','mailnesia.com',
    'mailcatch.com','dispostable.com','getairmail.com','fakeinbox.com','fakemail.net',
    'fakemailgenerator.com','mintemail.com','mohmal.com','mytemp.email','nada.email',
    'spambog.com','spambox.us','tempr.email','tmpmail.org','tmpmail.net','tmpeml.com',
    'inboxbear.com','inboxkitten.com','linshiyou.com','emailondeck.com','mail-temp.com',
    'mailtemp.info','tempinbox.com','crazymailing.com','disposablemail.com','mvrht.com',
    'inboxalias.com','mailpoof.com','mailtothis.com','mintmail.tk','muellmail.com',
    'nowmymail.com','rcpt.at','snapmail.cc','tempmailer.com','tempmailaddress.com',
    'wegwerfemail.de','wegwerfmail.de','wegwerfmail.net','wegwerfmail.org',
    'mailforspam.com','mail-tester.com','mailtemporaire.fr','jetable.org','jetable.com',
    'tempmail.plus','tempail.com','etempmail.net','minuteinbox.com','moakt.com',
    'mailtm.com','mail.tm','byom.de','burnermail.io','linkbasis.com','mvlaby.com'
  ]);
$$;

GRANT EXECUTE ON FUNCTION public.is_disposable_email(text) TO authenticated, anon, service_role;

-- Client-side preflight
CREATE OR REPLACE FUNCTION public.assert_email_allowed(_email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _email IS NULL OR length(_email) < 3 OR position('@' in _email) = 0 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF public.is_disposable_email(_email) THEN
    RAISE EXCEPTION 'disposable_email_not_allowed' USING ERRCODE = '22023';
  END IF;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.assert_email_allowed(text) TO anon, authenticated, service_role;

-- Server-side enforcement at profile creation (handle_new_user runs as SECDEF
-- and inserts into public.profiles → our BEFORE INSERT trigger fires).
CREATE OR REPLACE FUNCTION public.enforce_disposable_email_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IS NOT NULL AND public.is_disposable_email(v_email) THEN
    RAISE EXCEPTION 'disposable_email_not_allowed' USING
      ERRCODE = '22023',
      HINT = 'Use a permanent email provider (Gmail, Outlook, Yahoo, ProtonMail, your domain).';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_disposable_email ON public.profiles;
CREATE TRIGGER enforce_disposable_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_disposable_email_on_profile();

-- ---------- 2. RATE LIMIT TRIGGERS (small actions) -------------------
CREATE OR REPLACE FUNCTION public.rl_enforce(_action text, _max int, _window_seconds int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_count FROM rate_limit_log
    WHERE user_id = v_uid AND action = _action
      AND created_at > now() - make_interval(secs => _window_seconds);
  IF v_count >= _max THEN
    RAISE EXCEPTION 'rate_limited:%', _action USING ERRCODE = '53400',
      HINT = format('Max %s actions in %s seconds. Slow down.', _max, _window_seconds);
  END IF;
  INSERT INTO rate_limit_log(user_id, action) VALUES (v_uid, _action);
END $$;

GRANT EXECUTE ON FUNCTION public.rl_enforce(text,int,int) TO authenticated, service_role;

-- taps: 60/hour
CREATE OR REPLACE FUNCTION public.trg_rl_taps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('tap', 60, 3600); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_taps ON public.taps;
CREATE TRIGGER rl_taps BEFORE INSERT ON public.taps
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_taps();

-- woofs: 60/hour
CREATE OR REPLACE FUNCTION public.trg_rl_woofs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('woof', 60, 3600); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_woofs ON public.woofs;
CREATE TRIGGER rl_woofs BEFORE INSERT ON public.woofs
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_woofs();

-- favorites: 120/hour
CREATE OR REPLACE FUNCTION public.trg_rl_favorites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('favorite', 120, 3600); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_favorites ON public.favorites;
CREATE TRIGGER rl_favorites BEFORE INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_favorites();

-- story_views: 300/hour
CREATE OR REPLACE FUNCTION public.trg_rl_story_views()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('story_view', 300, 3600); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_story_views ON public.story_views;
CREATE TRIGGER rl_story_views BEFORE INSERT ON public.story_views
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_story_views();

-- offer_claims: 20/day
CREATE OR REPLACE FUNCTION public.trg_rl_offer_claims()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('offer_claim', 20, 86400); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_offer_claims ON public.offer_claims;
CREATE TRIGGER rl_offer_claims BEFORE INSERT ON public.offer_claims
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_offer_claims();

-- consent_log: 30/hour (anti-spam de revoke/grant)
CREATE OR REPLACE FUNCTION public.trg_rl_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.rl_enforce('consent_record', 30, 3600); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS rl_consent ON public.consent_log;
CREATE TRIGGER rl_consent BEFORE INSERT ON public.consent_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_consent();

-- business_applications: 3/day per user
CREATE OR REPLACE FUNCTION public.trg_rl_business_apps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.rl_enforce('business_application', 3, 86400);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_business_apps ON public.business_applications;
CREATE TRIGGER rl_business_apps BEFORE INSERT ON public.business_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_business_apps();

-- looking_now toggle: max 10 activations/hour
CREATE OR REPLACE FUNCTION public.trg_rl_looking_now()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.looking_now_until IS NOT NULL
     AND (OLD.looking_now_until IS NULL OR NEW.looking_now_until <> OLD.looking_now_until) THEN
    PERFORM public.rl_enforce('looking_now_toggle', 10, 3600);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_looking_now ON public.profiles;
CREATE TRIGGER rl_looking_now BEFORE UPDATE OF looking_now_until ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_looking_now();

-- ---------- 3. RISK SCORE WRITE PROTECTION ---------------------------
CREATE OR REPLACE FUNCTION public.prevent_risk_score_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.risk_score IS DISTINCT FROM OLD.risk_score
      OR NEW.risk_signals IS DISTINCT FROM OLD.risk_signals
      OR NEW.risk_updated_at IS DISTINCT FROM OLD.risk_updated_at)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_any_role(auth.uid(),
           ARRAY['admin','super_admin','moderator']::app_role[]) THEN
    RAISE EXCEPTION 'risk_score_write_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_risk_score_client_write ON public.profiles;
CREATE TRIGGER prevent_risk_score_client_write
  BEFORE UPDATE OF risk_score, risk_signals, risk_updated_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_risk_score_client_write();

-- ---------- 4. REAL RISK SCORING -------------------------------------
CREATE OR REPLACE FUNCTION public.compute_user_risk(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_created timestamptz;
  v_age_status text;
  v_photos_count int;
  v_open_reports int;
  v_my_fp_count int;       -- distinct fingerprints I use
  v_dup_users int;         -- other users sharing my fingerprints
  v_rapid_signup int;      -- accounts created from my fp in last 24h
  v_msgs_1h int;
  v_score int := 0;
  v_signals jsonb := '{}'::jsonb;
  v_flags text[] := ARRAY[]::text[];
BEGIN
  SELECT p.created_at, p.age_status, COALESCE(array_length(p.photos, 1), 0)
    INTO v_created, v_age_status, v_photos_count
  FROM public.profiles p WHERE p.id = _user_id;

  IF v_created IS NULL THEN
    RETURN jsonb_build_object('score', 0, 'signals', '{}'::jsonb, 'flags', '[]'::jsonb);
  END IF;

  -- Reports received (open)
  SELECT count(*) INTO v_open_reports FROM public.reports
    WHERE reported_id = _user_id AND status = 'open';

  -- Fingerprint reuse
  SELECT count(DISTINCT df2.user_id) INTO v_dup_users
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df1.fingerprint = df2.fingerprint
  WHERE df1.user_id = _user_id AND df2.user_id <> _user_id;

  -- Rapid signup pattern: other accounts created within 24h sharing any FP of mine
  SELECT count(DISTINCT df2.user_id) INTO v_rapid_signup
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df1.fingerprint = df2.fingerprint
  JOIN public.profiles p2 ON p2.id = df2.user_id
  WHERE df1.user_id = _user_id
    AND df2.user_id <> _user_id
    AND p2.created_at > v_now - interval '24 hours';

  -- Messages last hour
  SELECT count(*) INTO v_msgs_1h FROM public.messages
    WHERE sender_id = _user_id AND created_at > v_now - interval '1 hour';

  -- ---- scoring ----
  IF v_dup_users > 0 THEN
    v_score := v_score + LEAST(40, 15 + v_dup_users * 5);
    v_flags := v_flags || 'duplicate_fingerprint';
    v_signals := v_signals || jsonb_build_object('duplicate_fingerprint_users', v_dup_users);
  END IF;

  IF v_rapid_signup > 0 THEN
    v_score := v_score + LEAST(25, 10 + v_rapid_signup * 8);
    v_flags := v_flags || 'rapid_signup';
    v_signals := v_signals || jsonb_build_object('rapid_signup_24h', v_rapid_signup);
  END IF;

  IF v_age_status IS DISTINCT FROM 'verified' AND v_created < v_now - interval '24 hours' THEN
    v_score := v_score + 15;
    v_flags := v_flags || 'no_verification';
    v_signals := v_signals || jsonb_build_object('age_status', COALESCE(v_age_status,'unset'));
  END IF;

  IF v_photos_count = 0 AND v_created < v_now - interval '48 hours' THEN
    v_score := v_score + 10;
    v_flags := v_flags || 'no_photos';
  END IF;

  IF v_open_reports >= 3 THEN
    v_score := v_score + LEAST(40, 15 + v_open_reports * 5);
    v_flags := v_flags || 'multiple_reports';
    v_signals := v_signals || jsonb_build_object('open_reports', v_open_reports);
  END IF;

  IF v_created > v_now - interval '24 hours' AND v_msgs_1h > 30 THEN
    v_score := v_score + 20;
    v_flags := v_flags || 'spam_messages_new_account';
    v_signals := v_signals || jsonb_build_object('messages_1h', v_msgs_1h);
  ELSIF v_msgs_1h > 60 THEN
    v_score := v_score + 15;
    v_flags := v_flags || 'spam_messages';
    v_signals := v_signals || jsonb_build_object('messages_1h', v_msgs_1h);
  END IF;

  v_score := LEAST(100, GREATEST(0, v_score));

  RETURN jsonb_build_object(
    'score', v_score,
    'flags', to_jsonb(v_flags),
    'signals', v_signals,
    'computed_at', v_now
  );
END $$;

GRANT EXECUTE ON FUNCTION public.compute_user_risk(uuid) TO service_role;

-- Recompute + persist: writes profiles + upserts open risk_flags rows
CREATE OR REPLACE FUNCTION public.recompute_user_risk(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_score int;
  v_flags jsonb;
  v_flag text;
BEGIN
  v_res := public.compute_user_risk(_user_id);
  v_score := (v_res->>'score')::int;
  v_flags := v_res->'flags';

  UPDATE public.profiles
     SET risk_score      = v_score,
         risk_signals    = v_res->'signals',
         risk_updated_at = now()
   WHERE id = _user_id;

  -- Close stale open flags not in the new set
  UPDATE public.risk_flags
     SET status = 'resolved', resolved_at = now()
   WHERE user_id = _user_id
     AND status = 'open'
     AND NOT (v_flags ? kind);

  -- Insert new open flags
  FOR v_flag IN SELECT jsonb_array_elements_text(v_flags)
  LOOP
    INSERT INTO public.risk_flags(user_id, kind, severity, details, status)
    SELECT _user_id, v_flag,
           CASE WHEN v_score >= 70 THEN 3 WHEN v_score >= 40 THEN 2 ELSE 1 END,
           v_res->'signals', 'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.risk_flags
       WHERE user_id = _user_id AND kind = v_flag AND status = 'open'
    );
  END LOOP;

  RETURN v_res;
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_user_risk(uuid) TO service_role;

-- Reports → recompute reported user
CREATE OR REPLACE FUNCTION public.trg_recompute_risk_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_risk(NEW.reported_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS recompute_risk_on_report ON public.reports;
CREATE TRIGGER recompute_risk_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_risk_on_report();

-- New device fingerprint → recompute owner (catches reuse + rapid signup)
CREATE OR REPLACE FUNCTION public.trg_recompute_risk_on_fingerprint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_risk(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS recompute_risk_on_fingerprint ON public.device_fingerprints;
CREATE TRIGGER recompute_risk_on_fingerprint
  AFTER INSERT ON public.device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_risk_on_fingerprint();

-- Admin RPC: trigger recompute manually
CREATE OR REPLACE FUNCTION public.admin_recompute_user_risk(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(),
      ARRAY['admin','super_admin','moderator']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.recompute_user_risk(_user_id);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_recompute_user_risk(uuid) TO authenticated;
