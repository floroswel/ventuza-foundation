-- Permite oricărui utilizator autentificat să propună un event.
-- Publicarea rămâne blocată de triggerul events_no_self_publish + moderarea admin.
DROP POLICY IF EXISTS "Only business/admin can create events" ON public.events;

CREATE POLICY "Authenticated users can propose events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());