DROP POLICY IF EXISTS rc_authenticated_read ON public.referral_codes;
CREATE POLICY rc_owner_read ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = owner_id);