ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS friends_only_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_bio_url text,
  ADD COLUMN IF NOT EXISTS voice_bio_duration_sec integer,
  ADD COLUMN IF NOT EXISTS sos_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discreet_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'ro';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS voice_duration_sec integer,
  ADD COLUMN IF NOT EXISTS translated_text jsonb;

CREATE TABLE IF NOT EXISTS public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  city text,
  note text,
  contacts_notified jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sos_events TO authenticated;
GRANT ALL ON public.sos_events TO service_role;

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own SOS events"
  ON public.sos_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own SOS events"
  ON public.sos_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own SOS events"
  ON public.sos_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);