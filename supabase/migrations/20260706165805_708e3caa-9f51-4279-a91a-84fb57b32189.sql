CREATE TABLE IF NOT EXISTS public.message_locations (
  message_id uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.message_locations TO service_role;
ALTER TABLE public.message_locations ENABLE ROW LEVEL SECURITY;

INSERT INTO public.message_locations (message_id, sender_id, lat, lng, updated_at)
SELECT id, sender_id, location_lat, location_lng, now()
FROM public.messages
WHERE media_type = 'location'
  AND location_lat IS NOT NULL
  AND location_lng IS NOT NULL
ON CONFLICT (message_id) DO UPDATE
SET lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    updated_at = now();

UPDATE public.messages
SET location_lat = NULL,
    location_lng = NULL
WHERE media_type = 'location'
  AND (location_lat IS NOT NULL OR location_lng IS NOT NULL);

REVOKE SELECT, INSERT, UPDATE ON public.messages FROM authenticated;
GRANT SELECT (
  id,
  conversation_id,
  sender_id,
  body,
  read_at,
  created_at,
  reactions,
  media_type,
  media_url,
  audio_duration_ms,
  expires_at,
  view_once,
  viewed_at,
  reply_to_id,
  deleted_at,
  voice_url,
  voice_duration_sec,
  translated_text
) ON public.messages TO authenticated;
GRANT INSERT (
  conversation_id,
  sender_id,
  body,
  media_type,
  media_url,
  audio_duration_ms,
  expires_at,
  view_once,
  reply_to_id,
  voice_url,
  voice_duration_sec,
  translated_text
) ON public.messages TO authenticated;
GRANT UPDATE (
  read_at,
  viewed_at,
  reactions,
  deleted_at,
  body,
  media_url,
  media_type
) ON public.messages TO authenticated;
GRANT DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

CREATE OR REPLACE FUNCTION public.safe_message_row(_message_id uuid)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  reactions jsonb,
  media_type text,
  media_url text,
  audio_duration_ms integer,
  expires_at timestamptz,
  view_once boolean,
  viewed_at timestamptz,
  reply_to_id uuid,
  deleted_at timestamptz,
  voice_url text,
  voice_duration_sec integer,
  translated_text jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.id, m.conversation_id, m.sender_id, m.body, m.read_at, m.created_at,
         m.reactions, m.media_type, m.media_url, m.audio_duration_ms, m.expires_at,
         m.view_once, m.viewed_at, m.reply_to_id, m.deleted_at, m.voice_url,
         m.voice_duration_sec, m.translated_text
  FROM public.messages m
  WHERE m.id = _message_id
    AND public.is_conversation_participant(m.conversation_id, auth.uid())
$$;

REVOKE ALL ON FUNCTION public.safe_message_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_message_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_message_row(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.send_location_message(
  _conversation_id uuid,
  _lat double precision,
  _lng double precision,
  _label text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  reactions jsonb,
  media_type text,
  media_url text,
  audio_duration_ms integer,
  expires_at timestamptz,
  view_once boolean,
  viewed_at timestamptz,
  reply_to_id uuid,
  deleted_at timestamptz,
  voice_url text,
  voice_duration_sec integer,
  translated_text jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_message_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
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
$$;

REVOKE ALL ON FUNCTION public.send_location_message(uuid, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_location_message(uuid, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_location_message(uuid, double precision, double precision, text) TO service_role;

CREATE OR REPLACE FUNCTION public.update_live_location_message(
  _message_id uuid,
  _lat double precision,
  _lng double precision
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  reactions jsonb,
  media_type text,
  media_url text,
  audio_duration_ms integer,
  expires_at timestamptz,
  view_once boolean,
  viewed_at timestamptz,
  reply_to_id uuid,
  deleted_at timestamptz,
  voice_url text,
  voice_duration_sec integer,
  translated_text jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;

  UPDATE public.message_locations ml
  SET lat = _lat,
      lng = _lng,
      updated_at = now()
  FROM public.messages m
  WHERE ml.message_id = _message_id
    AND m.id = ml.message_id
    AND m.media_type = 'location'
    AND m.sender_id = v_me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'location_message_not_found' USING ERRCODE = '02000';
  END IF;

  RETURN QUERY SELECT * FROM public.safe_message_row(_message_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_live_location_message(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_live_location_message(uuid, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_live_location_message(uuid, double precision, double precision) TO service_role;

CREATE OR REPLACE FUNCTION public.get_message_location_bucket(_message_id uuid)
RETURNS TABLE (
  message_id uuid,
  label text,
  bucket_m double precision,
  can_open_map boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_msg record;
  v_me uuid := auth.uid();
  v_other_loc public.geography;
  v_distance double precision;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.conversation_id, m.sender_id, c.user_a, c.user_b, ml.lat, ml.lng
    INTO v_msg
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.message_locations ml ON ml.message_id = m.id
  WHERE m.id = _message_id
    AND m.media_type = 'location';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_me <> v_msg.user_a AND v_me <> v_msg.user_b THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_me = v_msg.sender_id THEN
    message_id := v_msg.id;
    label := 'Locația trimisă';
    bucket_m := NULL;
    can_open_map := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(travel_location, location, prev_location)
    INTO v_other_loc
  FROM public.profiles
  WHERE id = v_me;

  IF v_other_loc IS NULL OR v_msg.lat IS NULL OR v_msg.lng IS NULL THEN
    message_id := v_msg.id;
    label := 'Distanță indisponibilă';
    bucket_m := NULL;
    can_open_map := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_distance := ST_Distance(
    ST_SetSRID(ST_MakePoint(v_msg.lng, v_msg.lat), 4326)::public.geography,
    v_other_loc
  );

  message_id := v_msg.id;
  bucket_m := public.bucket_distance_m(v_distance);
  label := public.distance_bucket_label(v_distance);
  can_open_map := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_message_location_bucket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_location_bucket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_location_bucket(uuid) TO service_role;