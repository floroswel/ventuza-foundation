CREATE TABLE public.onboarding_drafts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  step INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_drafts TO authenticated;
GRANT ALL ON public.onboarding_drafts TO service_role;

ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own draft select" ON public.onboarding_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own draft insert" ON public.onboarding_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own draft update" ON public.onboarding_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own draft delete" ON public.onboarding_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.onboarding_drafts_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER onboarding_drafts_touch
BEFORE UPDATE ON public.onboarding_drafts
FOR EACH ROW EXECUTE FUNCTION public.onboarding_drafts_touch();