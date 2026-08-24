ALTER TABLE public.web_vitals ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE public.web_vitals ADD COLUMN IF NOT EXISTS platform text;
CREATE INDEX IF NOT EXISTS web_vitals_metric_version_idx ON public.web_vitals (metric, app_version, created_at DESC);