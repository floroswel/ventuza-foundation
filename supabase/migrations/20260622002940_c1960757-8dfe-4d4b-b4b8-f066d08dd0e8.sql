ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS health_data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.health_data_consent_at IS 'GDPR Art. 9(2)(a) explicit consent timestamp for processing health data (HIV status). NULL = no consent given; do not display health fields.';
COMMENT ON COLUMN public.profiles.marketing_consent_at IS 'Explicit opt-in timestamp for marketing communications.';