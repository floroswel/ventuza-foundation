
-- =========================================================================
-- CONSENT REGISTRY — single source of truth pentru tipurile de consimțământ
-- Vezi AGENTS.md "REGULĂ — CONSIMȚĂMINTE (permanentă)".
-- =========================================================================

-- 1) Registrul unic al tipurilor de consimțământ.
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE (
  kind            text,
  current_version text,
  required        boolean,  -- true = obligatoriu pentru a folosi serviciul (terms/privacy)
  art9            boolean,  -- true = date din categorii speciale GDPR Art. 9
  description     text
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('terms',              '2026-06-22', true,  false, 'Termeni și condiții.'),
    ('privacy',            '2026-06-22', true,  false, 'Politică de confidențialitate.'),
    ('health_data',        '2026-06-22', false, true,  'Date de sănătate (Art. 9): HIV status, dată test.'),
    ('age_verification',   '2026-06-26', false, true,  'Imagine biometrică (selfie) trimisă către Didit pentru estimarea vârstei. Art. 9.'),
    ('ai_features',        '2026-06-26', false, false, 'Text de profil / chat procesat de modele AI externe (Lovable AI Gateway).'),
    ('push_notifications', '2026-06-26', false, false, 'Abonament push web pentru notificări (mesaje, match-uri, evenimente).'),
    ('marketing',          '2026-06-22', false, false, 'Comunicări de marketing (newsletter, oferte).')
  ) AS t(kind, current_version, required, art9, description)
$$;

COMMENT ON FUNCTION public.consent_kinds() IS
'Single source of truth pentru kind-urile de consimțământ. Vezi AGENTS.md.';

GRANT EXECUTE ON FUNCTION public.consent_kinds() TO anon, authenticated, service_role;

-- 2) Verificare generică: ultima înregistrare per (user, kind) e accepted=true?
CREATE OR REPLACE FUNCTION public.has_active_consent(_user_id uuid, _kind text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT accepted
       FROM public.consent_log
      WHERE user_id = _user_id AND kind = _kind
      ORDER BY created_at DESC
      LIMIT 1),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_consent(uuid, text) TO authenticated, service_role;

-- 3) has_active_health_consent rămâne, dar deleg către cea generică.
CREATE OR REPLACE FUNCTION public.has_active_health_consent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_active_consent(_user_id, 'health_data')
$$;

-- 4) Endpoint generic pentru a înregistra consimțământ (acordare/retragere).
--    Verifică kind-ul împotriva registrului; refuză orice kind necunoscut.
CREATE OR REPLACE FUNCTION public.record_consent(
  _kind     text,
  _version  text DEFAULT NULL,
  _accepted boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_known   boolean;
  v_current text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT TRUE, current_version
    INTO v_known, v_current
    FROM public.consent_kinds()
   WHERE kind = _kind;

  IF v_known IS NULL THEN
    RAISE EXCEPTION 'unknown_consent_kind: %', _kind
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.consent_log (user_id, kind, version, accepted, user_agent)
  VALUES (auth.uid(), _kind, COALESCE(_version, v_current), COALESCE(_accepted, true), NULL);
END
$$;

GRANT EXECUTE ON FUNCTION public.record_consent(text, text, boolean) TO authenticated;
