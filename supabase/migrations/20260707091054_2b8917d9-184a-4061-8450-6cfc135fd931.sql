DROP POLICY IF EXISTS "Hosts can update their events" ON public.events;

CREATE POLICY "Hosts can update their events"
ON public.events
FOR UPDATE
TO authenticated
USING (host_id = auth.uid())
WITH CHECK (
  host_id = auth.uid()
  AND is_published = false
  AND moderation_status <> 'approved'
);