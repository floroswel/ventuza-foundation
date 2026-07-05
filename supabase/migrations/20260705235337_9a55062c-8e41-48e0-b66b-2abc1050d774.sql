
-- 1) DIDIT-ONLY VERIFICATION (enforce la DB)

-- a) elimină triggerul care sincroniza age_status din verification_status (cale ne-Didit)
DROP TRIGGER IF EXISTS trg_sync_age_status_from_verification ON public.profiles;

-- b) neutralizează scrierea de age_status din fluxul intern de moderator
CREATE OR REPLACE FUNCTION public.verification_moderator_decide(
  p_request_id uuid, p_decision text, p_reason_code text, p_reason text, p_confidence text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Fluxul intern de verificare este DEZACTIVAT: verificarea de vârstă
  -- se face EXCLUSIV prin Didit (public.didit_apply_result).
  RAISE EXCEPTION 'verification_moderator_disabled: age verification is Didit-only'
    USING ERRCODE = '42501';
END;
$$;

-- c) guard trigger: refuză age_status='verified' fără proof Didit
CREATE OR REPLACE FUNCTION public.enforce_didit_only_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.age_status = 'verified'::public.age_status
     AND (OLD.age_status IS DISTINCT FROM NEW.age_status
          OR OLD.age_provider IS DISTINCT FROM NEW.age_provider)
  THEN
    IF NEW.age_provider IS DISTINCT FROM 'didit'
       OR NOT EXISTS (
         SELECT 1 FROM public.didit_sessions ds
         WHERE ds.user_id = NEW.id AND ds.status = 'approved' AND ds.result = 'pass'
       )
    THEN
      RAISE EXCEPTION 'age_verified_requires_didit'
        USING ERRCODE = '42501',
              HINT = 'age_status=verified requires an approved Didit session (result=pass) and age_provider=didit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_didit_only_verification ON public.profiles;
CREATE TRIGGER trg_enforce_didit_only_verification
  BEFORE INSERT OR UPDATE OF age_status, age_provider ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_didit_only_verification();

-- 2) FIX 401 ÎN CONSOLĂ

-- a) get_country_risk trebuie apelabilă și de anon (rulează în root layout, înainte de auth)
GRANT EXECUTE ON FUNCTION public.get_country_risk(text) TO anon, authenticated;

-- b) web_vitals: adaugă policy INSERT pentru anon (metrici de performanță din vizitatori nelogați)
DROP POLICY IF EXISTS wv_insert_anon ON public.web_vitals;
CREATE POLICY wv_insert_anon ON public.web_vitals
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
GRANT INSERT ON public.web_vitals TO anon;
