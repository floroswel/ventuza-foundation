DROP POLICY IF EXISTS "Users manage their own rsvps" ON public.event_rsvps;

DROP POLICY IF EXISTS "Authenticated users can submit business application"
  ON public.business_applications;

CREATE POLICY "Authenticated users can submit business application"
  ON public.business_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    accepts_terms = true
    AND accepts_dpa = true
    AND accepts_lgbt_charter = true
    AND (user_id IS NULL OR user_id = auth.uid())
  );