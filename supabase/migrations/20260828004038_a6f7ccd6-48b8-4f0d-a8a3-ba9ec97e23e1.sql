-- =============================================================================
-- FIX 8 — Rate limit pe RPC-urile de listare profiluri (anti-scraping)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text, discreet_avatar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_calls int;
BEGIN
  PERFORM public.assert_age_verified();

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RETURN; END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_calls FROM public.rate_limit_log
   WHERE user_id = v_me AND action = 'profile_lookup'
     AND created_at > now() - interval '1 hour';
  IF v_calls >= 300 THEN
    RAISE EXCEPTION 'profile_lookup_rate_limited' USING ERRCODE = '53400';
  END IF;
  INSERT INTO public.rate_limit_log(user_id, action) VALUES (v_me, 'profile_lookup');

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

CREATE OR REPLACE FUNCTION public.list_visible_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, last_seen timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, interests text[], travel_city text, travel_until timestamp with time zone, boost_until timestamp with time zone, looking_now_until timestamp with time zone, "position" text, hide_age boolean, hide_online boolean, hide_distance boolean, incognito boolean, profile_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_calls int;
BEGIN
  PERFORM public.assert_age_verified();

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RETURN; END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_calls FROM public.rate_limit_log
   WHERE user_id = v_me AND action = 'profile_lookup'
     AND created_at > now() - interval '1 hour';
  IF v_calls >= 300 THEN
    RAISE EXCEPTION 'profile_lookup_rate_limited' USING ERRCODE = '53400';
  END IF;
  INSERT INTO public.rate_limit_log(user_id, action) VALUES (v_me, 'profile_lookup');

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

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_profiles(uuid[]) TO authenticated, service_role;

-- =============================================================================
-- FIX 9 — Locația partajată în chat expiră pentru destinatar (60 min)
-- Expeditorul își vede mereu propria locație. Peste fereastră, destinatarul
-- primește DOAR distanța bucketizată (regula permanentă de locație).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_message_location_bucket(_message_id uuid)
RETURNS TABLE(message_id uuid, label text, bucket_m double precision, can_open_map boolean, lat double precision, lng double precision)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg record;
  v_me uuid := auth.uid();
  v_other_loc public.geography;
  v_distance double precision;
  v_fresh boolean;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.conversation_id, m.sender_id, m.created_at,
         c.user_a, c.user_b, ml.lat, ml.lng, ml.updated_at
    INTO v_msg
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.message_locations ml ON ml.message_id = m.id
  WHERE m.id = _message_id AND m.media_type = 'location';

  IF NOT FOUND THEN RETURN; END IF;

  IF v_me <> v_msg.user_a AND v_me <> v_msg.user_b THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Expeditorul: acces nelimitat la propria locație.
  IF v_me = v_msg.sender_id THEN
    message_id := v_msg.id; label := 'Locația trimisă'; bucket_m := NULL;
    can_open_map := (v_msg.lat IS NOT NULL AND v_msg.lng IS NOT NULL);
    lat := v_msg.lat; lng := v_msg.lng;
    RETURN NEXT; RETURN;
  END IF;

  IF v_msg.lat IS NULL OR v_msg.lng IS NULL THEN
    message_id := v_msg.id; label := 'Locație indisponibilă'; bucket_m := NULL;
    can_open_map := false; lat := NULL; lng := NULL;
    RETURN NEXT; RETURN;
  END IF;

  SELECT COALESCE(travel_location, location, prev_location) INTO v_other_loc
  FROM public.profiles WHERE id = v_me;

  IF v_other_loc IS NOT NULL THEN
    v_distance := ST_Distance(
      ST_SetSRID(ST_MakePoint(v_msg.lng, v_msg.lat), 4326)::public.geography,
      v_other_loc
    );
    bucket_m := public.bucket_distance_m(v_distance);
    label := public.distance_bucket_label(v_distance);
  ELSE
    bucket_m := NULL; label := 'Locație partajată';
  END IF;

  -- Fereastra de partajare: 60 min de la ultima actualizare a poziției.
  v_fresh := COALESCE(v_msg.updated_at, v_msg.created_at) > now() - interval '60 minutes';

  message_id := v_msg.id;
  can_open_map := v_fresh;
  lat := CASE WHEN v_fresh THEN v_msg.lat ELSE NULL END;
  lng := CASE WHEN v_fresh THEN v_msg.lng ELSE NULL END;
  IF NOT v_fresh THEN
    label := COALESCE(label, 'Locație partajată') || ' · expirată';
  END IF;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_message_location_bucket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_location_bucket(uuid) TO authenticated, service_role;

-- =============================================================================
-- FIX 10 — Doar expeditorul poate actualiza coordonatele unui mesaj de locație
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_messages_only_read_at_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.created_at <> OLD.created_at
     OR NEW.audio_duration_ms IS DISTINCT FROM OLD.audio_duration_ms
     OR NEW.view_once IS DISTINCT FROM OLD.view_once
     OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
  THEN
    RAISE EXCEPTION 'Only controlled message updates are allowed';
  END IF;

  IF NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND NEW.body = ''
     AND NEW.media_url IS NULL
     AND NEW.media_type = 'text'
  THEN
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.media_type IS DISTINCT FROM OLD.media_type
     OR NEW.media_url IS DISTINCT FROM OLD.media_url
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'Messages cannot be edited after sending';
  END IF;

  IF NEW.location_lat IS DISTINCT FROM OLD.location_lat
     OR NEW.location_lng IS DISTINCT FROM OLD.location_lng
  THEN
    -- Doar mesajele de tip locație LIVE pot muta punctul, și doar expeditorul.
    IF OLD.media_type IS DISTINCT FROM 'location' THEN
      RAISE EXCEPTION 'Only live location messages can update location';
    END IF;
    IF auth.uid() IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'Only the sender can update a live location';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =============================================================================
-- FIX 11 — Igienă: curățare jurnal rate limit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_log() TO service_role;