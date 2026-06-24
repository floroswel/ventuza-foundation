DO $$ BEGIN
  CREATE TYPE public.age_status AS ENUM ('unverified','pending','verified','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_status public.age_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_provider text;

CREATE TABLE IF NOT EXISTS public.age_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'didit',
  result text NOT NULL,
  estimated_age numeric,
  didit_session_id text,
  status_raw text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.age_verifications TO authenticated;
GRANT ALL ON public.age_verifications TO service_role;

ALTER TABLE public.age_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own age verifications" ON public.age_verifications;
CREATE POLICY "own age verifications" ON public.age_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_age_verification(
  p_user_id uuid,
  p_result text,
  p_estimated_age numeric DEFAULT NULL,
  p_didit_session text DEFAULT NULL,
  p_status_raw text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.age_verifications(user_id, provider, result, estimated_age, didit_session_id, status_raw)
  VALUES (p_user_id, 'didit', p_result, p_estimated_age, p_didit_session, p_status_raw);

  IF p_result = 'pass' THEN
    UPDATE public.profiles
      SET age_status='verified', age_verified_at=now(), age_provider='didit'
      WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
      SET age_status='failed', age_provider='didit'
      WHERE id = p_user_id;
  END IF;

  INSERT INTO public.consent_log(user_id, kind, version, accepted)
  VALUES (p_user_id, 'age_assurance', 'didit', (p_result = 'pass'));

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after_data, severity)
  VALUES (
    p_user_id,
    'age_verification_' || p_result,
    'profiles',
    p_user_id::text,
    jsonb_build_object('provider','didit','session', p_didit_session, 'status', p_status_raw, 'est_age', p_estimated_age),
    CASE WHEN p_result='pass' THEN 'info' ELSE 'warning' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_age_verification(uuid,text,numeric,text,text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_age_verification(uuid,text,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.start_age_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET age_status='pending', age_provider='didit'
    WHERE id = auth.uid() AND age_status IN ('unverified','failed','expired');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_age_verification() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_age_verification() TO authenticated;

CREATE OR REPLACE FUNCTION public.require_age_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status public.age_status;
BEGIN
  SELECT age_status INTO v_status FROM public.profiles WHERE id = auth.uid();
  IF v_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Trebuie să îți confirmi vârsta (18+) înainte de a folosi această funcție.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_age_verified_messages ON public.messages;
CREATE TRIGGER trg_require_age_verified_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.require_age_verified();

DROP TRIGGER IF EXISTS trg_require_age_verified_swipes ON public.swipes;
CREATE TRIGGER trg_require_age_verified_swipes
  BEFORE INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.require_age_verified();

CREATE INDEX IF NOT EXISTS idx_profiles_age_status ON public.profiles(age_status);
CREATE INDEX IF NOT EXISTS idx_age_verifications_user ON public.age_verifications(user_id, created_at DESC);