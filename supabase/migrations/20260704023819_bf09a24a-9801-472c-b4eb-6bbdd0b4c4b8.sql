CREATE OR REPLACE FUNCTION public.verification_submit_request(p_challenges jsonb, p_image_paths text[], p_ip_hash text DEFAULT NULL::text, p_ua_hash text DEFAULT NULL::text, p_country text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _req_id uuid;
  _existing_pending int; _consent boolean;
  _i int; _path text; _challenge text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT public.has_active_consent(_uid, 'internal_verification') INTO _consent;
  IF NOT _consent THEN RAISE EXCEPTION 'consent_required' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO _existing_pending FROM public.verification_requests
    WHERE user_id = _uid AND status IN ('pending','in_review','needs_second');
  IF _existing_pending > 0 THEN RAISE EXCEPTION 'request_already_pending' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.verification_requests
      WHERE user_id = _uid AND submitted_at > now() - interval '24 hours') >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE='53400';
  END IF;
  IF jsonb_array_length(p_challenges) <> 3 OR array_length(p_image_paths,1) <> 3 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE='22023';
  END IF;
  FOR _i IN 1..3 LOOP
    _path := p_image_paths[_i];
    IF _path IS NULL OR position((_uid::text || '/') IN _path) <> 1 THEN
      RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE='42501';
    END IF;
  END LOOP;
  INSERT INTO public.verification_requests (user_id, status, method, challenges, ip_hash, ua_hash, country)
  VALUES (_uid, 'pending', 'internal_liveness_v1', p_challenges,
     substring(p_ip_hash for 128), substring(p_ua_hash for 128), substring(p_country for 8))
  RETURNING id INTO _req_id;
  FOR _i IN 1..3 LOOP
    _challenge := p_challenges->>(_i-1);
    INSERT INTO public.verification_images(request_id, order_idx, challenge_code, storage_path)
      VALUES (_req_id, _i, _challenge, p_image_paths[_i]);
  END LOOP;
  UPDATE public.profiles SET age_status='pending', age_pending_at=now() WHERE id=_uid;
  INSERT INTO public.verification_audit(request_id, user_id, action, ip_hash, ua_hash, country)
    VALUES (_req_id, _uid, 'submitted', substring(p_ip_hash for 128), substring(p_ua_hash for 128), substring(p_country for 8));
  INSERT INTO public.notifications(user_id, type, title, body, link, entity_id)
    VALUES (_uid, 'admin_message'::notification_type, 'Verificare trimisă',
      'Am primit selfie-urile tale. Un moderator va verifica în cel mai scurt timp.',
      '/verify', _req_id);
  RETURN _req_id;
END; $function$;