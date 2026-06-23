CREATE TABLE IF NOT EXISTS public.profile_live_events (
  user_id uuid PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_live_events TO authenticated;
GRANT ALL ON public.profile_live_events TO service_role;

ALTER TABLE public.profile_live_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profile live refresh signals" ON public.profile_live_events;
CREATE POLICY "Authenticated users can read profile live refresh signals"
ON public.profile_live_events
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can manage own profile live signal" ON public.profile_live_events;
CREATE POLICY "Users can manage own profile live signal"
ON public.profile_live_events
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_profile_live_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.location IS DISTINCT FROM OLD.location OR NEW.last_seen IS DISTINCT FROM OLD.last_seen THEN
    INSERT INTO public.profile_live_events (user_id, updated_at)
    VALUES (NEW.id, now())
    ON CONFLICT (user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_live_event ON public.profiles;
CREATE TRIGGER profile_live_event
AFTER UPDATE OF location, last_seen ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_live_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profile_live_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_live_events;
  END IF;
END $$;