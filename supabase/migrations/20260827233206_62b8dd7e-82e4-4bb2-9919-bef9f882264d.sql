-- Gate de verificare 18+ pe RPC-urile care expun date despre alți utilizatori
-- sau deschid interacțiuni sociale. Staff-ul are bypass prin assert_account_usable.

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text, discreet_avatar text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_age_verified();
  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.last_seen END,
    p.birthdate, p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug, p.discreet_avatar
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_visible_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_age_verified();
  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.last_seen END,
    p.birthdate, p.tribes,
    p.pronouns, p.gender, p.body_type, p.height_cm, p.bio, p.interests,
    p.travel_city, p.travel_until, p.boost_until,
    CASE WHEN p.incognito IS TRUE AND p.id <> auth.uid() THEN NULL ELSE p.looking_now_until END,
    p."position", p.hide_age, p.hide_online, p.hide_distance, p.incognito,
    p.profile_slug
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      p.incognito IS NOT TRUE
      OR p.id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.user_a = auth.uid() AND c.user_b = p.id)
           OR (c.user_b = auth.uid() AND c.user_a = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE (m.user_a = auth.uid() AND m.user_b = p.id)
           OR (m.user_b = auth.uid() AND m.user_a = p.id)
      )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_notification_actors(_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, photo text, profile_slug text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_age_verified();
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    CASE WHEN array_length(p.photos, 1) > 0 THEN p.photos[1] ELSE NULL END,
    p.profile_slug
  FROM public.profiles AS p
  WHERE p.id = ANY(_ids)
    AND EXISTS (
      SELECT 1 FROM public.notifications AS n
      WHERE n.user_id = auth.uid() AND n.actor_id = p.id
    )
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks AS b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_local_leaderboard(_radius_km integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, level integer, weekly_xp integer, streak_days integer, rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me_loc geography;
  wk date := public.current_week_start();
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.assert_age_verified();
  SELECT location INTO me_loc FROM public.profiles WHERE id = auth.uid();
  IF me_loc IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH weekly AS (
    SELECT xe.user_id, SUM(xe.xp)::int AS xp_sum
      FROM public.xp_events xe
     WHERE xe.created_at >= wk
     GROUP BY xe.user_id
  )
  SELECT p.id,
         p.display_name,
         (p.photos->0->>'path')::text AS photo_url,
         p.level,
         COALESCE(w.xp_sum, 0) AS weekly_xp,
         p.streak_days,
         (ROW_NUMBER() OVER (ORDER BY COALESCE(w.xp_sum, 0) DESC, p.level DESC))::int AS rank
    FROM public.profiles p
    LEFT JOIN weekly w ON w.user_id = p.id
   WHERE p.leaderboard_opt_in = true
     AND p.incognito IS NOT TRUE
     AND p.location IS NOT NULL
     AND ST_DWithin(p.location, me_loc, _radius_km * 1000)
     AND p.id <> auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
          OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
     )
   ORDER BY weekly_xp DESC, p.level DESC
   LIMIT 20;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_message_viewed(_msg_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _conv_id uuid;
BEGIN
  PERFORM public.assert_age_verified();
  SELECT conversation_id INTO _conv_id FROM public.messages WHERE id = _msg_id;
  IF _conv_id IS NULL THEN RETURN; END IF;
  UPDATE public.messages
     SET viewed_at = COALESCE(viewed_at, now())
   WHERE id = _msg_id AND sender_id <> auth.uid();
END $function$;

CREATE OR REPLACE FUNCTION public.unsend_message(_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m public.messages%ROWTYPE;
BEGIN
  PERFORM public.assert_age_verified();
  SELECT * INTO m FROM public.messages WHERE id = _message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'message not found'; END IF;
  IF m.sender_id <> auth.uid() THEN RAISE EXCEPTION 'not owner'; END IF;
  IF m.created_at < now() - interval '5 minutes' THEN RAISE EXCEPTION 'too late to unsend'; END IF;
  UPDATE public.messages
     SET deleted_at = now(),
         body = '',
         media_url = NULL,
         media_type = 'text'
   WHERE id = _message_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_message_reaction(_msg_id uuid, _emoji text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _msg public.messages%ROWTYPE;
  _conv public.conversations%ROWTYPE;
  _users jsonb;
  _new jsonb;
  _arr text[];
  ALLOWED text[] := ARRAY['❤️','🔥','😂','😮','😢','👍'];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.assert_age_verified();
  IF NOT (_emoji = ANY(ALLOWED)) THEN RAISE EXCEPTION 'emoji not allowed'; END IF;
  SELECT * INTO _msg FROM public.messages WHERE id = _msg_id;
  IF _msg.id IS NULL THEN RAISE EXCEPTION 'message not found'; END IF;
  SELECT * INTO _conv FROM public.conversations WHERE id = _msg.conversation_id;
  IF _conv.user_a <> _uid AND _conv.user_b <> _uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _new := COALESCE(_msg.reactions, '{}'::jsonb);
  _users := _new -> _emoji;
  IF _users IS NULL THEN
    _new := _new || jsonb_build_object(_emoji, jsonb_build_array(_uid::text));
  ELSE
    SELECT array_agg(value) INTO _arr FROM jsonb_array_elements_text(_users);
    IF _uid::text = ANY(_arr) THEN
      _arr := array_remove(_arr, _uid::text);
    ELSE
      _arr := array_append(_arr, _uid::text);
    END IF;
    IF array_length(_arr,1) IS NULL OR array_length(_arr,1) = 0 THEN
      _new := _new - _emoji;
    ELSE
      _new := jsonb_set(_new, ARRAY[_emoji], to_jsonb(_arr));
    END IF;
  END IF;

  UPDATE public.messages SET reactions = _new WHERE id = _msg_id;
  RETURN _new;
END $function$;

CREATE OR REPLACE FUNCTION public.send_location_message(_conversation_id uuid, _lat double precision, _lng double precision, _label text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, body text, read_at timestamp with time zone, created_at timestamp with time zone, reactions jsonb, media_type text, media_url text, audio_duration_ms integer, expires_at timestamp with time zone, view_once boolean, viewed_at timestamp with time zone, reply_to_id uuid, deleted_at timestamp with time zone, voice_url text, voice_duration_sec integer, translated_text jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_message_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_age_verified();
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_conversation_participant(_conversation_id, v_me) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body, media_type)
  VALUES (_conversation_id, v_me, COALESCE(NULLIF(left(_label, 120), ''), '📍 Locație partajată'), 'location')
  RETURNING messages.id INTO v_message_id;

  INSERT INTO public.message_locations (message_id, sender_id, lat, lng)
  VALUES (v_message_id, v_me, _lat, _lng);

  RETURN QUERY SELECT * FROM public.safe_message_row(v_message_id);
END;
$function$;