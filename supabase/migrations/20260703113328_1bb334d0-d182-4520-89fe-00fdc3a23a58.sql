DROP POLICY IF EXISTS "authenticated read translations" ON public.profile_translations;

CREATE POLICY "owner reads own translations"
ON public.profile_translations
FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);