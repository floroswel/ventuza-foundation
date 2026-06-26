-- Add birth_date and discrete_mode columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS discrete_mode boolean NOT NULL DEFAULT false;

-- Enforce 18+ via trigger (CHECK can't use now())
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'Trebuie să ai cel puțin 18 ani.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_min_age ON public.profiles;
CREATE TRIGGER trg_enforce_min_age
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_age();