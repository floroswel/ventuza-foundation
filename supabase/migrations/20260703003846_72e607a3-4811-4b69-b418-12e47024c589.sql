CREATE TABLE IF NOT EXISTS public.profile_translations (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field text NOT NULL,
  text_hash text NOT NULL,
  target_lang text NOT NULL,
  translated text NOT NULL,
  source_lang text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, field, text_hash, target_lang)
);

GRANT SELECT ON public.profile_translations TO authenticated;
GRANT ALL ON public.profile_translations TO service_role;

ALTER TABLE public.profile_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read translations"
  ON public.profile_translations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS profile_translations_profile_lang_idx
  ON public.profile_translations (profile_id, target_lang);