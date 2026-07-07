DROP POLICY IF EXISTS "Authenticated users can view public events" ON public.events;

CREATE POLICY "Authenticated users can view public events"
ON public.events
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR (
    is_private = false
    AND is_published = true
    AND moderation_status = 'approved'
  )
);