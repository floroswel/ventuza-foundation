
-- PII Didit
ALTER TABLE public.age_verifications DROP COLUMN IF EXISTS didit_session_id;
ALTER TABLE public.age_verifications DROP COLUMN IF EXISTS raw_payload;
ALTER TABLE public.age_verifications DROP COLUMN IF EXISTS status_raw;
ALTER TABLE public.age_verifications DROP COLUMN IF EXISTS selfie_url;
ALTER TABLE public.age_verifications DROP COLUMN IF EXISTS document_url;
ALTER TABLE public.age_verifications ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'didit_legacy';

ALTER TABLE public.profiles DROP COLUMN IF EXISTS age_provider;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_method text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_version int NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_score numeric(3,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.profiles SET verification_method = 'didit_legacy'
  WHERE age_status = 'verified' AND verification_method IS NULL;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_selfie_path;

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','approved','rejected','needs_second','appeal','expired')),
  method text NOT NULL DEFAULT 'internal_liveness_v1',
  version int NOT NULL DEFAULT 1,
  challenges jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  decided_at timestamptz,
  decision text CHECK (decision IN ('approve','reject','needs_second','appeal_required')),
  reason text,
  reason_code text CHECK (reason_code IN ('low_quality','face_not_visible','multiple_people','suspected_fake','underage_suspicion','replay_attack','deepfake_suspicion','other')),
  confidence text CHECK (confidence IN ('low','medium','high')),
  score numeric(3,2),
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  second_moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  second_decision text CHECK (second_decision IN ('approve','reject')),
  second_reason text,
  needs_second boolean NOT NULL DEFAULT false,
  appeal_of uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  ip_hash text,
  ua_hash text,
  country text,
  review_duration_ms int,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_requests_status_idx ON public.verification_requests(status, submitted_at);
CREATE INDEX IF NOT EXISTS verification_requests_user_idx ON public.verification_requests(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS verification_requests_moderator_idx ON public.verification_requests(moderator_id) WHERE moderator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS verification_requests_retention_idx ON public.verification_requests(retention_until);
GRANT SELECT ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own requests" ON public.verification_requests;
CREATE POLICY "user reads own requests" ON public.verification_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "verification staff reads all" ON public.verification_requests;
CREATE POLICY "verification staff reads all" ON public.verification_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'verification_moderator') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'));

CREATE TABLE IF NOT EXISTS public.verification_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  order_idx int NOT NULL,
  challenge_code text NOT NULL,
  storage_path text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(request_id, order_idx)
);
CREATE INDEX IF NOT EXISTS verification_images_request_idx ON public.verification_images(request_id);
GRANT SELECT ON public.verification_images TO authenticated;
GRANT ALL ON public.verification_images TO service_role;
ALTER TABLE public.verification_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verification staff reads images metadata" ON public.verification_images;
CREATE POLICY "verification staff reads images metadata" ON public.verification_images FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'verification_moderator') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'));

CREATE TABLE IF NOT EXISTS public.verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  user_id uuid,
  moderator_id uuid,
  action text NOT NULL,
  decision text,
  reason text,
  ip_hash text,
  ua_hash text,
  country text,
  review_duration_ms int,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_audit_request_idx ON public.verification_audit(request_id);
CREATE INDEX IF NOT EXISTS verification_audit_moderator_idx ON public.verification_audit(moderator_id, created_at DESC);
GRANT SELECT ON public.verification_audit TO authenticated;
GRANT ALL ON public.verification_audit TO service_role;
ALTER TABLE public.verification_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit read by super_admin and auditor" ON public.verification_audit;
CREATE POLICY "audit read by super_admin and auditor" ON public.verification_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'));

CREATE OR REPLACE FUNCTION public.prevent_verification_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'verification_audit is append-only'; END; $$;
DROP TRIGGER IF EXISTS trg_verification_audit_no_update ON public.verification_audit;
CREATE TRIGGER trg_verification_audit_no_update
BEFORE UPDATE OR DELETE ON public.verification_audit
FOR EACH ROW EXECUTE FUNCTION public.prevent_verification_audit_mutation();

CREATE OR REPLACE FUNCTION public.tg_verification_requests_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_verification_requests_updated ON public.verification_requests;
CREATE TRIGGER trg_verification_requests_updated
BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_verification_requests_updated_at();

DROP FUNCTION IF EXISTS public.consent_kinds();
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE(kind text, current_version int, required boolean, art9 boolean, description text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('terms', 1, true, false, 'Termeni și condiții'),
    ('privacy', 1, true, false, 'Politica de confidențialitate'),
    ('age_verification', 2, true, true, 'Procesare imagini pentru verificare vârstă (proces intern, fără terți)'),
    ('internal_verification', 1, true, true, 'Verificare identitate internă prin selfie-uri liveness — review manual de moderator'),
    ('health_data', 1, false, true, 'Date de sănătate (HIV status)'),
    ('ai_features', 1, false, false, 'Funcții AI (recomandări, moderare, traducere)'),
    ('push_notifications', 1, false, false, 'Notificări push'),
    ('background_location', 1, false, false, 'Locație în background pentru geofencing'),
    ('marketing', 1, false, false, 'Comunicări marketing')
  ) AS t(kind, current_version, required, art9, description);
$$;

CREATE OR REPLACE FUNCTION public.assert_verification_or_limited()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT age_status::text INTO _s FROM public.profiles WHERE id = auth.uid();
  IF _s IS NULL THEN RAISE EXCEPTION 'profile_missing' USING ERRCODE = '42501'; END IF;
  IF _s NOT IN ('verified','pending') THEN RAISE EXCEPTION 'verification_required' USING ERRCODE = '42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.assert_verification_or_limited() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_verification_or_limited() TO authenticated;

CREATE OR REPLACE FUNCTION public.verification_generate_challenges()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pool text[] := ARRAY['blink','smile','turn_head_left','turn_head_right','raise_left_hand','raise_right_hand','touch_nose','touch_left_ear','touch_right_ear','show_two_fingers'];
  picked text[]; i int; idx int; chosen text;
BEGIN
  PERFORM public.assert_account_usable();
  picked := ARRAY[]::text[];
  FOR i IN 1..3 LOOP
    LOOP
      idx := 1 + floor(random() * array_length(pool,1))::int;
      chosen := pool[idx];
      EXIT WHEN NOT (chosen = ANY(picked));
    END LOOP;
    picked := array_append(picked, chosen);
  END LOOP;
  RETURN to_jsonb(picked);
END; $$;
REVOKE ALL ON FUNCTION public.verification_generate_challenges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_generate_challenges() TO authenticated;

CREATE OR REPLACE FUNCTION public.verification_submit_request(
  p_challenges jsonb, p_image_paths text[],
  p_ip_hash text DEFAULT NULL, p_ua_hash text DEFAULT NULL, p_country text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO public.notifications(user_id, kind, title, body, data)
    VALUES (_uid, 'verification_submitted', 'Verificare trimisă',
      'Am primit selfie-urile tale. Un moderator va verifica în cel mai scurt timp.',
      jsonb_build_object('request_id', _req_id));
  RETURN _req_id;
END; $$;
REVOKE ALL ON FUNCTION public.verification_submit_request(jsonb, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_submit_request(jsonb, text[], text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_verification_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('verification_moderator','admin','super_admin'));
$$;
REVOKE ALL ON FUNCTION public.is_verification_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verification_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verification_moderator_claim()
RETURNS TABLE(request_id uuid, challenges jsonb, submitted_at timestamptz, image_ids uuid[], image_paths text[], challenge_codes text[], is_second_review boolean, version int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _req record;
BEGIN
  IF NOT public.is_verification_staff(_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.verification_requests r
     SET status = 'in_review', claimed_at = now(), second_moderator_id = _uid
   WHERE r.id = (SELECT id FROM public.verification_requests
      WHERE status = 'needs_second' AND moderator_id IS DISTINCT FROM _uid AND second_moderator_id IS NULL
      ORDER BY submitted_at FOR UPDATE SKIP LOCKED LIMIT 1)
   RETURNING r.* INTO _req;
  IF _req.id IS NULL THEN
    UPDATE public.verification_requests r
       SET status = 'in_review', claimed_at = now(), moderator_id = _uid
     WHERE r.id = (SELECT id FROM public.verification_requests
        WHERE status = 'pending' ORDER BY submitted_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING r.* INTO _req;
  END IF;
  IF _req.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.verification_audit(request_id, user_id, moderator_id, action)
    VALUES (_req.id, _req.user_id, _uid, 'claimed');
  RETURN QUERY
  SELECT _req.id, _req.challenges, _req.submitted_at,
    (SELECT array_agg(i.id ORDER BY i.order_idx) FROM public.verification_images i WHERE i.request_id = _req.id),
    (SELECT array_agg(i.storage_path ORDER BY i.order_idx) FROM public.verification_images i WHERE i.request_id = _req.id),
    (SELECT array_agg(i.challenge_code ORDER BY i.order_idx) FROM public.verification_images i WHERE i.request_id = _req.id),
    (_req.needs_second AND _req.moderator_id IS DISTINCT FROM _uid),
    _req.version;
END; $$;
REVOKE ALL ON FUNCTION public.verification_moderator_claim() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_moderator_claim() TO authenticated;

CREATE OR REPLACE FUNCTION public.verification_moderator_decide(
  p_request_id uuid, p_decision text, p_reason_code text, p_reason text, p_confidence text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _req public.verification_requests;
  _is_second boolean; _final text; _duration int;
BEGIN
  IF NOT public.is_verification_staff(_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('approve','reject','needs_second','appeal_required') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE='22023';
  END IF;
  IF p_reason_code IS NULL OR length(coalesce(p_reason,'')) < 1 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE='22023';
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

CREATE OR REPLACE FUNCTION public.verification_list_purgeable_paths()
RETURNS TABLE(request_id uuid, storage_path text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT vi.request_id, vi.storage_path FROM public.verification_images vi
    JOIN public.verification_requests vr ON vr.id = vi.request_id
   WHERE vi.deleted_at IS NULL AND vr.retention_until < now();
$$;
REVOKE ALL ON FUNCTION public.verification_list_purgeable_paths() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_list_purgeable_paths() TO service_role;

CREATE OR REPLACE FUNCTION public.verification_mark_purged(p_request_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  UPDATE public.verification_images SET deleted_at = now()
    WHERE request_id = ANY(p_request_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE public.verification_requests SET status = 'expired'
    WHERE id = ANY(p_request_ids) AND status IN ('rejected','pending','appeal');
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.verification_mark_purged(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_mark_purged(uuid[]) TO service_role;

DROP POLICY IF EXISTS "verification: user uploads own" ON storage.objects;
CREATE POLICY "verification: user uploads own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP FUNCTION IF EXISTS public.record_age_verification(uuid, text, integer, text, text);
DROP FUNCTION IF EXISTS public.start_age_verification();

INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, severity, justification, after_data)
VALUES (NULL, 'verification_redesign_migration', 'verification_requests', NULL, 'info',
  'Redesign verificare: eliminat Didit PII, tabele interne noi, rol verification_moderator, bucket privat, retention 30 zile.',
  jsonb_build_object('phase','1_foundation'));
