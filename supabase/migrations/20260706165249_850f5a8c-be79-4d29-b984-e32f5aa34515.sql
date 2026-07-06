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
  v_other uuid;
  v_other_loc public.geography;
  v_distance double precision;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.conversation_id, m.sender_id, m.media_type, m.location_lat, m.location_lng,
         c.user_a, c.user_b
    INTO v_msg
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
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

  v_other := v_me;
  SELECT COALESCE(travel_location, location, prev_location)
    INTO v_other_loc
  FROM public.profiles
  WHERE id = v_other;

  IF v_other_loc IS NULL OR v_msg.location_lat IS NULL OR v_msg.location_lng IS NULL THEN
    message_id := v_msg.id;
    label := 'Distanță indisponibilă';
    bucket_m := NULL;
    can_open_map := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_distance := ST_Distance(
    ST_SetSRID(ST_MakePoint(v_msg.location_lng, v_msg.location_lat), 4326)::public.geography,
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

CREATE OR REPLACE FUNCTION public.admin_reveal_profile_location(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  p record;
  loc public.geography;
  loc_kind text;
BEGIN
  SELECT id, travel_city, last_seen, last_check_in_at, location, travel_location, prev_location
    INTO p
  FROM public.profiles
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'profile_exists', false,
      'reason', 'profile_not_found'
    );
  END IF;

  loc := COALESCE(p.travel_location, p.location, p.prev_location);
  loc_kind := CASE
    WHEN p.travel_location IS NOT NULL THEN 'travel_location'
    WHEN p.location IS NOT NULL THEN 'location'
    WHEN p.prev_location IS NOT NULL THEN 'prev_location'
    ELSE NULL
  END;

  IF loc IS NULL THEN
    RETURN jsonb_build_object(
      'profile_exists', true,
      'has_location', false,
      'reason', 'no_location_on_profile',
      'travel_city', p.travel_city,
      'last_seen', p.last_seen,
      'last_check_in_at', p.last_check_in_at
    );
  END IF;

  RETURN jsonb_build_object(
    'profile_exists', true,
    'has_location', true,
    'source', loc_kind,
    'travel_city', p.travel_city,
    'last_seen', p.last_seen,
    'last_check_in_at', p.last_check_in_at,
    'lat', ST_Y(loc::public.geometry),
    'lng', ST_X(loc::public.geometry)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reveal_profile_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reveal_profile_location(uuid) TO service_role;