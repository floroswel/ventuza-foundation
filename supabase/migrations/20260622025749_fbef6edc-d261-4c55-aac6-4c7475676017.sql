DROP POLICY IF EXISTS "Users can create their own events" ON public.events;

CREATE POLICY "Only business/admin can create events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'business'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);