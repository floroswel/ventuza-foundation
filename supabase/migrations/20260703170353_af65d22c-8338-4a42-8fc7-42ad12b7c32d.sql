-- 1) Sync one-time: verification_status → age_status
UPDATE public.profiles
SET age_status = CASE verification_status
    WHEN 'approved' THEN 'verified'::public.age_status
    WHEN 'rejected' THEN 'failed'::public.age_status
    WHEN 'pending'  THEN 'pending'::public.age_status
    ELSE 'unverified'::public.age_status
  END,
  age_verified_at = CASE WHEN verification_status='approved' AND age_verified_at IS NULL THEN now() ELSE age_verified_at END
WHERE verification_status IS NOT NULL
  AND age_status IS DISTINCT FROM (CASE verification_status
    WHEN 'approved' THEN 'verified'::public.age_status
    WHEN 'rejected' THEN 'failed'::public.age_status
    WHEN 'pending'  THEN 'pending'::public.age_status
    ELSE 'unverified'::public.age_status
  END);

-- And reverse-sync legacy Didit approvals into new column
UPDATE public.profiles
SET verification_status = 'approved',
    verification_method = COALESCE(verification_method, 'didit_legacy')
WHERE age_status = 'verified' AND verification_status IS DISTINCT FROM 'approved';

-- 2) Trigger to keep age_status in sync going forward
CREATE OR REPLACE FUNCTION public.sync_age_status_from_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    NEW.age_status := CASE NEW.verification_status
      WHEN 'approved' THEN 'verified'::public.age_status
      WHEN 'rejected' THEN 'failed'::public.age_status
      WHEN 'pending'  THEN 'pending'::public.age_status
      ELSE 'unverified'::public.age_status
    END;
    IF NEW.verification_status = 'approved' AND NEW.age_verified_at IS NULL THEN
      NEW.age_verified_at := now();
    END IF;
    IF NEW.verification_status = 'pending' AND NEW.age_pending_at IS NULL THEN
      NEW.age_pending_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_age_status_from_verification ON public.profiles;
CREATE TRIGGER trg_sync_age_status_from_verification
BEFORE UPDATE OF verification_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_age_status_from_verification();

-- 3) Drop Didit-specific artifacts
DROP FUNCTION IF EXISTS public.record_age_verification(uuid, text, numeric, text, text);
DROP TABLE IF EXISTS public.age_verifications CASCADE;

-- 4) Remove legacy Didit setting
DELETE FROM public.app_settings WHERE key = 'age_verification_stale';
