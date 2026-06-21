
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_prompt_path text,
  ADD COLUMN IF NOT EXISTS voice_prompt_question text,
  ADD COLUMN IF NOT EXISTS voice_prompt_duration_sec int,
  ADD COLUMN IF NOT EXISTS anthem jsonb,
  ADD COLUMN IF NOT EXISTS top_artists jsonb,
  ADD COLUMN IF NOT EXISTS zodiac text,
  ADD COLUMN IF NOT EXISTS languages text[],
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS politics text,
  ADD COLUMN IF NOT EXISTS children text,
  ADD COLUMN IF NOT EXISTS pets text[],
  ADD COLUMN IF NOT EXISTS drinking text,
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS cannabis text,
  ADD COLUMN IF NOT EXISTS drugs text,
  ADD COLUMN IF NOT EXISTS workout text,
  ADD COLUMN IF NOT EXISTS diet text,
  ADD COLUMN IF NOT EXISTS sleep_schedule text,
  ADD COLUMN IF NOT EXISTS dealbreakers text[],
  ADD COLUMN IF NOT EXISTS ideal_match text,
  ADD COLUMN IF NOT EXISTS ask_me_about text[],
  ADD COLUMN IF NOT EXISTS profile_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS video_clip_path text;

CREATE OR REPLACE FUNCTION public.ensure_profile_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; candidate text; i int := 0;
BEGIN
  IF NEW.profile_slug IS NOT NULL AND NEW.profile_slug <> '' THEN RETURN NEW; END IF;
  base := lower(regexp_replace(coalesce(NEW.display_name, 'user'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  IF base = '' OR base IS NULL THEN base := 'user'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE profile_slug = candidate AND id <> NEW.id) LOOP
    i := i + 1;
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
    IF i > 10 THEN candidate := base || '-' || replace(NEW.id::text, '-', ''); EXIT; END IF;
  END LOOP;
  NEW.profile_slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_profile_slug ON public.profiles;
CREATE TRIGGER trg_ensure_profile_slug
  BEFORE INSERT OR UPDATE OF display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_slug();

UPDATE public.profiles SET display_name = display_name WHERE profile_slug IS NULL;
