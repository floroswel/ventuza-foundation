
ALTER TABLE public.risk_flags ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.deletion_requests ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS risk_flags_is_seed_idx ON public.risk_flags (is_seed) WHERE is_seed = true;
CREATE INDEX IF NOT EXISTS deletion_requests_is_seed_idx ON public.deletion_requests (is_seed) WHERE is_seed = true;
