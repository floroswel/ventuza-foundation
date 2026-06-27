
-- 1) Promovează contul admin recent la super_admin pentru deblocare panouri (break-glass, GDPR force-purge, demo seed).
INSERT INTO public.user_roles (user_id, role)
SELECT '7a414412-80bf-44c9-961f-8e90cf4cb73b'::uuid, 'super_admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id='7a414412-80bf-44c9-961f-8e90cf4cb73b' AND role='super_admin'
);

-- 2) Adaugă flag is_seed la tabelele care nu îl au (pentru extinderea seed-ului demo + ștergere curată).
ALTER TABLE public.reports                    ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.illegal_content_reports    ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.csam_reports               ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.admin_alerts               ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.breach_incidents           ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.policy_versions            ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.business_applications      ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS reports_is_seed_idx                 ON public.reports(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS illegal_content_reports_is_seed_idx ON public.illegal_content_reports(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS csam_reports_is_seed_idx            ON public.csam_reports(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS admin_alerts_is_seed_idx            ON public.admin_alerts(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS breach_incidents_is_seed_idx        ON public.breach_incidents(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS policy_versions_is_seed_idx         ON public.policy_versions(is_seed) WHERE is_seed;
CREATE INDEX IF NOT EXISTS business_applications_is_seed_idx   ON public.business_applications(is_seed) WHERE is_seed;
