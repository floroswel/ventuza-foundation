
-- Helper: cel mai înalt rol al userului curent.
CREATE OR REPLACE FUNCTION public.admin_get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT role::text FROM public.user_roles
   WHERE user_id = auth.uid()
   ORDER BY CASE role::text
     WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
     WHEN 'auditor' THEN 3 WHEN 'moderator' THEN 4
     WHEN 'support' THEN 5 WHEN 'read_only' THEN 6 ELSE 9
   END
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.admin_get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_my_role() TO authenticated, service_role;

-- Cine poate accesa date sensibile (break-glass).
CREATE OR REPLACE FUNCTION public.admin_can_access_sensitive(_user_id uuid, _kind text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE lower(_kind)
    WHEN 'health'   THEN public.has_role(_user_id, 'super_admin')
    WHEN 'location' THEN public.has_role(_user_id, 'super_admin')
    WHEN 'selfie'   THEN public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
    WHEN 'messages' THEN public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION public.admin_can_access_sensitive(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_can_access_sensitive(uuid, text) TO authenticated, service_role;

-- Log break-glass.
CREATE TABLE IF NOT EXISTS public.admin_sensitive_access_log (
  id              bigserial PRIMARY KEY,
  actor_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id  uuid,
  kind            text NOT NULL CHECK (kind IN ('health','location','selfie','messages')),
  fields          text[] NOT NULL DEFAULT '{}',
  justification   text NOT NULL,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_sensitive_access_log TO authenticated;
GRANT ALL    ON public.admin_sensitive_access_log TO service_role;
ALTER TABLE public.admin_sensitive_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sensitive_log readable by auditors+super_admin" ON public.admin_sensitive_access_log;
CREATE POLICY "sensitive_log readable by auditors+super_admin"
ON public.admin_sensitive_access_log FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','auditor']::app_role[]));

DROP TRIGGER IF EXISTS sensitive_access_log_immutable ON public.admin_sensitive_access_log;
CREATE TRIGGER sensitive_access_log_immutable
BEFORE UPDATE OR DELETE ON public.admin_sensitive_access_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE INDEX IF NOT EXISTS idx_sensitive_log_actor  ON public.admin_sensitive_access_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitive_log_target ON public.admin_sensitive_access_log(target_user_id, created_at DESC);

-- App settings (sursa autoritativă) + istoric.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL    ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings readable by everyone" ON public.app_settings;
CREATE POLICY "app_settings readable by everyone"
ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.app_settings_history (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  value jsonb NOT NULL,
  version int NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings_history TO authenticated;
GRANT ALL    ON public.app_settings_history TO service_role;
ALTER TABLE public.app_settings_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings history readable by staff" ON public.app_settings_history;
CREATE POLICY "settings history readable by staff"
ON public.app_settings_history FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_settings_history_key ON public.app_settings_history(key, version DESC);

-- Feature flags.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_pct int NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL    ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature_flags readable by everyone" ON public.feature_flags;
CREATE POLICY "feature_flags readable by everyone"
ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.feature_flags(key, enabled, description) VALUES
 ('ai_assist',        true, 'Asistent AI pentru bio / poze'),
 ('sos',              true, 'Buton SOS și escaladare'),
 ('events',           true, 'Modul Evenimente'),
 ('age_verification', true, 'Verificare vârstă cu Didit'),
 ('premium',          true, 'Abonament Premium'),
 ('stories',          true, 'Stories 24h')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings(key, value, category, description) VALUES
 ('discover.score_weights',
   '{"distance":0.35,"recent":0.25,"interests":0.20,"verified":0.10,"premium":0.10}'::jsonb,
   'matching', 'Ponderi scor discover (sum=1)'),
 ('discover.bucket_thresholds_m',
   '[1000,5000,15000,50000]'::jsonb,
   'matching', 'Praguri buckets distanță (m) — informativ; sursa reală e bucket_distance_m()'),
 ('retention.months', '24'::jsonb, 'gdpr',  'Retenție inactivitate (luni)'),
 ('rate_limits.messages_per_min', '20'::jsonb, 'limits', 'Mesaje pe minut per user'),
 ('system.maintenance_message', '""'::jsonb, 'system', 'Mesaj banner sistem (gol = ascuns)')
ON CONFLICT (key) DO NOTHING;

-- RPC update setting (versionare + istoric).
CREATE OR REPLACE FUNCTION public.admin_update_setting(_key text, _value jsonb, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v int; BEGIN
  IF NOT public.has_any_role(_actor, ARRAY['super_admin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
    VALUES (_key, _value, _actor, now())
  ON CONFLICT (key) DO UPDATE
    SET value=EXCLUDED.value, version=public.app_settings.version+1,
        updated_by=EXCLUDED.updated_by, updated_at=now()
  RETURNING version INTO v;
  INSERT INTO public.app_settings_history(key, value, version, changed_by)
    VALUES (_key, _value, v, _actor);
  RETURN jsonb_build_object('ok', true, 'version', v);
END $$;
REVOKE ALL ON FUNCTION public.admin_update_setting(text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb, uuid) TO service_role;
