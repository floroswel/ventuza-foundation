
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_above(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_above(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','moderator','support','auditor'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- IP allowlist
CREATE TABLE IF NOT EXISTS public.admin_ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr text NOT NULL,
  label text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_ip_allowlist TO authenticated;
GRANT ALL ON public.admin_ip_allowlist TO service_role;
ALTER TABLE public.admin_ip_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage IP allowlist" ON public.admin_ip_allowlist;
CREATE POLICY "Admins manage IP allowlist" ON public.admin_ip_allowlist FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Admin login attempts
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id bigserial PRIMARY KEY,
  email text, user_id uuid, ip inet, user_agent text,
  success boolean NOT NULL DEFAULT false, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ala_ip_time ON public.admin_login_attempts(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ala_email_time ON public.admin_login_attempts(email, created_at DESC);
GRANT SELECT ON public.admin_login_attempts TO authenticated;
GRANT ALL ON public.admin_login_attempts TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view login attempts" ON public.admin_login_attempts;
CREATE POLICY "Admins view login attempts" ON public.admin_login_attempts FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- MFA status
CREATE TABLE IF NOT EXISTS public.admin_mfa_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz, last_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_mfa_status TO authenticated;
GRANT ALL ON public.admin_mfa_status TO service_role;
ALTER TABLE public.admin_mfa_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own mfa" ON public.admin_mfa_status;
CREATE POLICY "Users see own mfa" ON public.admin_mfa_status FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "Users insert own mfa" ON public.admin_mfa_status;
CREATE POLICY "Users insert own mfa" ON public.admin_mfa_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own mfa" ON public.admin_mfa_status;
CREATE POLICY "Users update own mfa" ON public.admin_mfa_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== AUDIT LOG =====
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  actor_email text,
  action text NOT NULL,
  target_table text, target_id text,
  before_data jsonb, after_data jsonb,
  justification text, ip inet, user_agent text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_log(target_table, target_id);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read audit" ON public.admin_audit_log;
CREATE POLICY "Staff read audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','auditor']::app_role[]));

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'admin_audit_log is append-only'; END $$;
DROP TRIGGER IF EXISTS trg_audit_no_update ON public.admin_audit_log;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.admin_audit_log;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- ===== CSAM / Safety =====
ALTER TABLE public.photo_hashes
  ADD COLUMN IF NOT EXISTS csam_match boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nudity_score numeric,
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz;

CREATE TABLE IF NOT EXISTS public.csam_hash_blocklist (
  hash text PRIMARY KEY, source text,
  added_by uuid REFERENCES auth.users(id),
  added_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.csam_hash_blocklist TO authenticated;
GRANT ALL ON public.csam_hash_blocklist TO service_role;
ALTER TABLE public.csam_hash_blocklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage csam blocklist" ON public.csam_hash_blocklist;
CREATE POLICY "Admin manage csam blocklist" ON public.csam_hash_blocklist FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.csam_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  photo_url text, hash text, match_source text,
  ncmec_report_id text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending', notes text
);
GRANT SELECT, INSERT, UPDATE ON public.csam_reports TO authenticated;
GRANT ALL ON public.csam_reports TO service_role;
ALTER TABLE public.csam_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage csam reports" ON public.csam_reports;
CREATE POLICY "Admin manage csam reports" ON public.csam_reports FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- ===== GDPR =====
CREATE TABLE IF NOT EXISTS public.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, version text NOT NULL,
  content_url text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (kind, version)
);
GRANT SELECT ON public.policy_versions TO authenticated, anon;
GRANT ALL ON public.policy_versions TO service_role;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads policy versions" ON public.policy_versions;
CREATE POLICY "Anyone reads policy versions" ON public.policy_versions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage policy versions" ON public.policy_versions;
CREATE POLICY "Admin manage policy versions" ON public.policy_versions FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.consent_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL, version text NOT NULL, accepted boolean NOT NULL,
  ip inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON public.consent_log(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User sees own consent" ON public.consent_log;
CREATE POLICY "User sees own consent" ON public.consent_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "User logs own consent" ON public.consent_log;
CREATE POLICY "User logs own consent" ON public.consent_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  reason text, status text NOT NULL DEFAULT 'scheduled',
  processed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User own deletion" ON public.deletion_requests;
CREATE POLICY "User own deletion" ON public.deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "User requests own deletion" ON public.deletion_requests;
CREATE POLICY "User requests own deletion" ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin manages deletion" ON public.deletion_requests;
CREATE POLICY "Admin manages deletion" ON public.deletion_requests FOR UPDATE TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.breach_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  notify_deadline timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  description text, affected_users_count int,
  data_categories text[], dpo_contact text,
  authority_notified_at timestamptz, users_notified_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.breach_incidents TO authenticated;
GRANT ALL ON public.breach_incidents TO service_role;
ALTER TABLE public.breach_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages breach" ON public.breach_incidents;
CREATE POLICY "Admin manages breach" ON public.breach_incidents FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.illegal_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_email text,
  reporter_user_id uuid REFERENCES auth.users(id),
  content_url text, content_type text,
  category text NOT NULL, description text NOT NULL,
  legal_basis text, status text NOT NULL DEFAULT 'pending',
  handled_by uuid REFERENCES auth.users(id),
  handled_at timestamptz, resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.illegal_content_reports TO authenticated, anon;
GRANT UPDATE ON public.illegal_content_reports TO authenticated;
GRANT ALL ON public.illegal_content_reports TO service_role;
ALTER TABLE public.illegal_content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone files dsa report" ON public.illegal_content_reports;
CREATE POLICY "Anyone files dsa report" ON public.illegal_content_reports FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read dsa reports" ON public.illegal_content_reports;
CREATE POLICY "Staff read dsa reports" ON public.illegal_content_reports FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator','support','auditor']::app_role[]));
DROP POLICY IF EXISTS "Mods handle dsa reports" ON public.illegal_content_reports;
CREATE POLICY "Mods handle dsa reports" ON public.illegal_content_reports FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]));

-- Alerts
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id bigserial PRIMARY KEY,
  kind text NOT NULL, severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL, body text,
  target_table text, target_id text,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_unack ON public.admin_alerts(created_at DESC) WHERE acknowledged_at IS NULL;
GRANT SELECT, UPDATE ON public.admin_alerts TO authenticated;
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read alerts" ON public.admin_alerts;
CREATE POLICY "Staff read alerts" ON public.admin_alerts FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator','support','auditor']::app_role[]));
DROP POLICY IF EXISTS "Staff ack alerts" ON public.admin_alerts;
CREATE POLICY "Staff ack alerts" ON public.admin_alerts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]));

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts;
