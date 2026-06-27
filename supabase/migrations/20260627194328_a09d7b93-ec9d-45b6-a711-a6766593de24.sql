
-- Drop the duplicate trigger that referenced the orphan column
DROP TRIGGER IF EXISTS trg_enforce_min_age ON public.profiles;

-- Make the function authoritative on `birthdate` (standard column)
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.birthdate IS NOT NULL AND NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Trebuie să ai cel puțin 18 ani.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the canonical trigger exists on `birthdate`
DROP TRIGGER IF EXISTS enforce_min_age_trg ON public.profiles;
CREATE TRIGGER enforce_min_age_trg
  BEFORE INSERT OR UPDATE OF birthdate ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_age();

-- Now safe to drop the orphan column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birth_date;
