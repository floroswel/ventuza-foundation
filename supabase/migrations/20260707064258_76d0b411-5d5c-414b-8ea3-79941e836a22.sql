DROP FUNCTION IF EXISTS public.get_message_location_bucket(uuid);

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
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.conversation_id, m.sender_id, c.user_a, c.user_b, ml.lat, ml.lng
    INTO v_msg
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.message_locations ml ON ml.message_id = m.id
  WHERE m.id = _message_id AND m.media_type = 'location';

  IF NOT FOUND THEN RETURN; END IF;

  IF v_me <> v_msg.user_a AND v_me <> v_msg.user_b THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_me = v_msg.sender_id THEN
    message_id := v_msg.id; label := 'Locația trimisă'; bucket_m := NULL;
    can_open_map := true; lat := v_msg.lat; lng := v_msg.lng;
    RETURN NEXT; RETURN;
  END IF;

  SELECT COALESCE(travel_location, location, prev_location) INTO v_other_loc
  FROM public.profiles WHERE id = v_me;

  IF v_msg.lat IS NULL OR v_msg.lng IS NULL THEN
    message_id := v_msg.id; label := 'Locație indisponibilă'; bucket_m := NULL;
    can_open_map := false; lat := NULL; lng := NULL;
    RETURN NEXT; RETURN;
  END IF;

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

  message_id := v_msg.id; can_open_map := true;
  lat := v_msg.lat; lng := v_msg.lng;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_message_location_bucket(uuid) TO authenticated;