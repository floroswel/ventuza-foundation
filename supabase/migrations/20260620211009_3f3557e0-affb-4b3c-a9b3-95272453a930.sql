-- Sprint 3: verification, travel mode, boost
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_selfie_path text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS travel_city text,
  ADD COLUMN IF NOT EXISTS travel_location geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS travel_until timestamptz,
  ADD COLUMN IF NOT EXISTS boost_until timestamptz;

-- Index pentru ordering boost în discover
CREATE INDEX IF NOT EXISTS profiles_boost_until_idx
  ON public.profiles (boost_until DESC NULLS LAST);

-- Index spațial pentru travel
CREATE INDEX IF NOT EXISTS profiles_travel_location_gix
  ON public.profiles USING GIST (travel_location);

-- Constrângere status: doar valori valide
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_verification_status_chk
    CHECK (verification_status IN ('unverified','pending','verified','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
