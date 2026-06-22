
CREATE OR REPLACE FUNCTION public.grant_business_role_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'business'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_app_approved ON public.business_applications;
CREATE TRIGGER trg_business_app_approved
  AFTER UPDATE ON public.business_applications
  FOR EACH ROW EXECUTE FUNCTION public.grant_business_role_on_approval();

DROP POLICY IF EXISTS advertisers_owner_insert ON public.advertisers;
CREATE POLICY advertisers_business_insert
  ON public.advertisers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'business'::public.app_role));
