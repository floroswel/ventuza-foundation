ALTER TABLE public.photo_reviews
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'profile',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS ai_labels jsonb,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_reviews_surface_chk'
  ) THEN
    ALTER TABLE public.photo_reviews
      ADD CONSTRAINT photo_reviews_surface_chk CHECK (surface IN ('profile','album'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_reviews_source_chk'
  ) THEN
    ALTER TABLE public.photo_reviews
      ADD CONSTRAINT photo_reviews_source_chk CHECK (source IN ('upload','scan','report'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_reviews_severity_chk'
  ) THEN
    ALTER TABLE public.photo_reviews
      ADD CONSTRAINT photo_reviews_severity_chk CHECK (severity IN ('normal','high','critical'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS photo_reviews_surface_idx
  ON public.photo_reviews (surface, status, created_at DESC);