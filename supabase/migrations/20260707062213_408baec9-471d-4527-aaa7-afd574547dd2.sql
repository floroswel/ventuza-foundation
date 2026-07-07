CREATE OR REPLACE FUNCTION public.compute_user_risk(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_created timestamptz;
  v_age_status text;
  v_photos_count int;
  v_open_reports int;
  v_dup_users int;
  v_rapid_signup int;
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

  SELECT count(*) INTO v_open_reports FROM public.reports
    WHERE reported_id = _user_id AND status = 'open';

  SELECT count(DISTINCT df2.user_id) INTO v_dup_users
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df1.fingerprint = df2.fingerprint
  WHERE df1.user_id = _user_id AND df2.user_id <> _user_id;

  SELECT count(DISTINCT df2.user_id) INTO v_rapid_signup
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df1.fingerprint = df2.fingerprint
  JOIN public.profiles p2 ON p2.id = df2.user_id
  WHERE df1.user_id = _user_id
    AND df2.user_id <> _user_id
    AND p2.created_at > v_now - interval '24 hours';

  SELECT count(*) INTO v_msgs_1h FROM public.messages
    WHERE sender_id = _user_id AND created_at > v_now - interval '1 hour';

  IF v_dup_users > 0 THEN
    v_score := v_score + LEAST(40, 15 + v_dup_users * 5);
    v_flags := array_append(v_flags, 'duplicate_fingerprint'::text);
    v_signals := v_signals || jsonb_build_object('duplicate_fingerprint_users', v_dup_users);
  END IF;

  IF v_rapid_signup > 0 THEN
    v_score := v_score + LEAST(25, 10 + v_rapid_signup * 8);
    v_flags := array_append(v_flags, 'rapid_signup'::text);
    v_signals := v_signals || jsonb_build_object('rapid_signup_24h', v_rapid_signup);
  END IF;

  IF v_age_status IS DISTINCT FROM 'verified' AND v_created < v_now - interval '24 hours' THEN
    v_score := v_score + 15;
    v_flags := array_append(v_flags, 'no_verification'::text);
    v_signals := v_signals || jsonb_build_object('age_status', COALESCE(v_age_status,'unset'));
  END IF;

  IF v_photos_count = 0 AND v_created < v_now - interval '48 hours' THEN
    v_score := v_score + 10;
    v_flags := array_append(v_flags, 'no_photos'::text);
  END IF;

  IF v_open_reports >= 3 THEN
    v_score := v_score + LEAST(40, 15 + v_open_reports * 5);
    v_flags := array_append(v_flags, 'multiple_reports'::text);
    v_signals := v_signals || jsonb_build_object('open_reports', v_open_reports);
  END IF;

  IF v_created > v_now - interval '24 hours' AND v_msgs_1h > 30 THEN
    v_score := v_score + 20;
    v_flags := array_append(v_flags, 'spam_messages_new_account'::text);
    v_signals := v_signals || jsonb_build_object('messages_1h', v_msgs_1h);
  ELSIF v_msgs_1h > 60 THEN
    v_score := v_score + 15;
    v_flags := array_append(v_flags, 'spam_messages'::text);
    v_signals := v_signals || jsonb_build_object('messages_1h', v_msgs_1h);
  END IF;

  v_score := LEAST(100, GREATEST(0, v_score));

  RETURN jsonb_build_object(
    'score', v_score,
    'flags', to_jsonb(v_flags),
    'signals', v_signals,
    'computed_at', v_now
  );
END $function$;