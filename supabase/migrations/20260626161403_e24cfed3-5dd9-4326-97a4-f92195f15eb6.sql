-- =========================================================================
-- HEALTH DATA CONSENT ENFORCEMENT (GDPR Art. 9)
-- Vezi AGENTS.md secțiunea "REGULĂ — DATE DE SĂNĂTATE (permanentă)".
-- =========================================================================

-- 1. Lista centrală a câmpurilor health-gated. SINGURUL loc de modificat
--    când adaugi alte câmpuri de sănătate (ex: prep_status, std_status, etc.).
CREATE OR REPLACE FUNCTION public.health_gated_columns()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['hiv_status', 'hiv_test_date']::text[]
$$;

COMMENT ON FUNCTION public.health_gated_columns() IS
'Câmpurile pe `profiles` care necesită consimțământ activ `health_data`. Singurul loc de modificat. Vezi AGENTS.md.';

-- 2. Verifică dacă userul are consimțământ `health_data` activ.
--    "Activ" = ultima înregistrare pentru (user_id, kind=health_data) are accepted=true.
CREATE OR REPLACE FUNCTION public.has_active_health_consent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT accepted
       FROM public.consent_log
      WHERE user_id = _user_id AND kind = 'health_data'
      ORDER BY created_at DESC
      LIMIT 1),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_health_consent(uuid) TO authenticated, service_role;

-- 3. Trigger pe profiles: blochează scrierea de date health-gated fără consimțământ activ.
--    Excepție: a seta valoarea pe NULL e mereu permis (e ștergere, nu scriere de date).
CREATE OR REPLACE FUNCTION public.enforce_health_consent_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_hiv_status text;
  v_old_hiv_test_date date;
  v_writing_health  boolean := false;
BEGIN
  -- Detectează dacă această operație introduce/modifică o coloană health-gated cu valoare non-NULL.
  IF TG_OP = 'INSERT' THEN
    v_writing_health := (NEW.hiv_status IS NOT NULL) OR (NEW.hiv_test_date IS NOT NULL);
  ELSE
    v_old_hiv_status   := OLD.hiv_status;
    v_old_hiv_test_date := OLD.hiv_test_date;
    v_writing_health :=
      (NEW.hiv_status IS NOT NULL    AND NEW.hiv_status    IS DISTINCT FROM v_old_hiv_status) OR
      (NEW.hiv_test_date IS NOT NULL AND NEW.hiv_test_date IS DISTINCT FROM v_old_hiv_test_date);
  END IF;

  IF v_writing_health AND NOT public.has_active_health_consent(NEW.id) THEN
    RAISE EXCEPTION 'health_consent_required: nu se pot scrie date de sănătate fără consimțământ activ (kind=health_data în consent_log)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_health_consent ON public.profiles;
CREATE TRIGGER enforce_health_consent
  BEFORE INSERT OR UPDATE OF hiv_status, hiv_test_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_health_consent_on_profile();

-- 4. Trigger pe consent_log: retragerea consimțământului = ștergere automată a datelor.
CREATE OR REPLACE FUNCTION public.cascade_health_consent_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'health_data' AND NEW.accepted = false THEN
    UPDATE public.profiles
       SET hiv_status = NULL,
           hiv_test_date = NULL,
           health_data_consent_at = NULL
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS cascade_health_consent_withdrawal ON public.consent_log;
CREATE TRIGGER cascade_health_consent_withdrawal
  AFTER INSERT ON public.consent_log
  FOR EACH ROW EXECUTE FUNCTION public.cascade_health_consent_withdrawal();

-- 5. RPC pentru retragerea explicită a consimțământului din UI.
CREATE OR REPLACE FUNCTION public.withdraw_health_consent(_version text DEFAULT '2026-06-22')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  INSERT INTO public.consent_log (user_id, kind, version, accepted, user_agent)
  VALUES (auth.uid(), 'health_data', _version, false, NULL);
  -- triggerul cascade_health_consent_withdrawal va NULL-iza datele.
END
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_health_consent(text) TO authenticated;