CREATE OR REPLACE FUNCTION public.verification_moderator_decide(
  p_request_id uuid, p_decision text, p_reason_code text, p_reason text, p_confidence text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _req public.verification_requests;
  _is_second boolean; _final text; _duration int;
  _allowed_reason_codes text[] := ARRAY['low_quality','face_not_visible','multiple_people','suspected_fake','underage_suspicion','replay_attack','deepfake_suspicion','other'];
  _allowed_confidence  text[] := ARRAY['low','medium','high'];
BEGIN
  IF NOT public.is_verification_staff(_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('approve','reject','needs_second','appeal_required') THEN
    RAISE EXCEPTION 'invalid_decision: valoare permisă = approve|reject|needs_second|appeal_required' USING ERRCODE='22023';
  END IF;
  IF p_reason_code IS NULL OR p_reason_code = '' THEN
    RAISE EXCEPTION 'reason_code_required: alege un motiv din listă (%)', array_to_string(_allowed_reason_codes, ', ') USING ERRCODE='22023';
  END IF;
  IF NOT (p_reason_code = ANY (_allowed_reason_codes)) THEN
    RAISE EXCEPTION 'invalid_reason_code: "%" nu este permis. Valori acceptate: %', p_reason_code, array_to_string(_allowed_reason_codes, ', ') USING ERRCODE='22023';
  END IF;
  IF p_confidence IS NOT NULL AND p_confidence <> '' AND NOT (p_confidence = ANY (_allowed_confidence)) THEN
    RAISE EXCEPTION 'invalid_confidence: "%" nu este permis. Valori acceptate: %', p_confidence, array_to_string(_allowed_confidence, ', ') USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_reason,'')) < 3 THEN
    RAISE EXCEPTION 'reason_required: motivul trebuie să aibă cel puțin 3 caractere' USING ERRCODE='22023';
  END IF;

  SELECT * INTO _req FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42704'; END IF;
  _is_second := (_req.needs_second AND _req.second_moderator_id = _uid);
  IF NOT _is_second AND _req.moderator_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'not_your_claim' USING ERRCODE='42501';
  END IF;
  _duration := EXTRACT(EPOCH FROM (now() - coalesce(_req.claimed_at, _req.submitted_at))) * 1000;
  IF _is_second THEN
    IF p_decision NOT IN ('approve','reject') THEN
      RAISE EXCEPTION 'second_review_binary' USING ERRCODE='22023';
    END IF;
    UPDATE public.verification_requests
       SET second_decision = p_decision, second_reason = p_reason, decided_at = now(),
           status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
           review_duration_ms = coalesce(review_duration_ms,0) + _duration
     WHERE id = p_request_id;
    _final := p_decision;
  ELSE
    IF p_decision = 'needs_second' THEN
      UPDATE public.verification_requests
         SET needs_second = true, status = 'needs_second', decision = 'needs_second',
             reason_code = p_reason_code, reason = p_reason, confidence = p_confidence, review_duration_ms = _duration
       WHERE id = p_request_id;
      _final := 'needs_second';
    ELSIF p_decision = 'appeal_required' THEN
      UPDATE public.verification_requests
         SET status = 'appeal', decision = 'appeal_required',
             reason_code = p_reason_code, reason = p_reason, confidence = p_confidence,
             decided_at = now(), review_duration_ms = _duration
       WHERE id = p_request_id;
      _final := 'appeal';
    ELSE
      UPDATE public.verification_requests
         SET status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
             decision = p_decision, reason_code = p_reason_code, reason = p_reason,
             confidence = p_confidence, decided_at = now(), review_duration_ms = _duration
       WHERE id = p_request_id;
      _final := p_decision;
    END IF;
  END IF;
  IF _final IN ('approve','reject') THEN
    UPDATE public.profiles
       SET age_status = CASE WHEN _final='approve' THEN 'verified'::age_status ELSE 'failed'::age_status END,
           age_verified_at = CASE WHEN _final='approve' THEN now() ELSE NULL END,
           verified = CASE WHEN _final='approve' THEN true ELSE false END,
           verified_at = CASE WHEN _final='approve' THEN now() ELSE NULL END,
           verification_method = 'internal_liveness_v1',
           verification_reviewed_by = _uid,
           verification_status = CASE WHEN _final='approve' THEN 'verified' ELSE 'rejected' END
     WHERE id = _req.user_id;
    INSERT INTO public.notifications(user_id, kind, title, body, data)
    VALUES (_req.user_id,
      CASE WHEN _final='approve' THEN 'verification_approved' ELSE 'verification_rejected' END,
      CASE WHEN _final='approve' THEN 'Ești verificat' ELSE 'Verificare respinsă' END,
      CASE WHEN _final='approve' THEN 'Contul tău are acum badge-ul verificat.'
           ELSE 'Verificarea nu a putut fi confirmată. Poți face o cerere nouă.' END,
      jsonb_build_object('request_id', p_request_id, 'reason_code', p_reason_code));
  ELSIF _final = 'appeal' THEN
    INSERT INTO public.notifications(user_id, kind, title, body, data)
    VALUES (_req.user_id, 'verification_appeal', 'Verificare — necesită apel',
      'Verificarea ta necesită mai multe informații.',
      jsonb_build_object('request_id', p_request_id));
  END IF;
  INSERT INTO public.verification_audit(request_id, user_id, moderator_id, action, decision, reason, review_duration_ms, metadata)
  VALUES (p_request_id, _req.user_id, _uid,
    CASE WHEN _is_second THEN 'second_decision' ELSE 'decision' END,
    p_decision, p_reason, _duration,
    jsonb_build_object('reason_code', p_reason_code, 'confidence', p_confidence));
END; $$;

REVOKE ALL ON FUNCTION public.verification_moderator_decide(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_moderator_decide(uuid, text, text, text, text) TO authenticated;