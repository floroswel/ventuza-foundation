-- ============================================================================
-- A1: Restrângere policy TO anon acolo unde nu e necesar
-- ============================================================================

-- ad_campaigns: campaniile se afișează doar în feed/discover, care sunt
-- authenticated-only. Anon nu are motiv legitim să le vadă.
DROP POLICY IF EXISTS ad_campaigns_public_active ON public.ad_campaigns;
CREATE POLICY ad_campaigns_active_read
  ON public.ad_campaigns
  FOR SELECT
  TO authenticated
  USING (status = 'active' AND ends_at > now() AND starts_at <= now());
COMMENT ON POLICY ad_campaigns_active_read ON public.ad_campaigns IS
  'Campaniile active sunt vizibile doar userilor autentificați (feed/discover). Anon fără caz de utilizare.';

-- experiments: alocările A/B nu trebuie enumerabile de vizitatori nelogați.
DROP POLICY IF EXISTS exp_read ON public.experiments;
CREATE POLICY experiments_read_authenticated
  ON public.experiments
  FOR SELECT
  TO authenticated
  USING (true);
COMMENT ON POLICY experiments_read_authenticated ON public.experiments IS
  'Lista de experimente A/B este vizibilă doar userilor autentificați (client SDK alocare). Anon nu are context.';

-- Justificare documentată pentru cele care RĂMÂN accesibile anon:
COMMENT ON POLICY "badge_registry_read_all" ON public.badge_registry IS
  'Anon read OK: badge-urile sunt metadate vizuale (nume, icon, tier) folosite pe paginile publice de profil (/u/:slug). Nu conțin PII.';
COMMENT ON POLICY "Public read country risk" ON public.country_risk_config IS
  'Anon read OK: config-ul de risc pe țară e folosit pentru gate-ul de signup (blochează țări interzise ÎNAINTE de auth). Fără PII.';
COMMENT ON POLICY "legal_documents public read published" ON public.legal_documents IS
  'Anon read OK: paginile legale (Terms/Privacy/Cookies) trebuie citite fără auth pentru compliance GDPR + Play Store.';
COMMENT ON POLICY "wv_insert_anon" ON public.web_vitals IS
  'Anon insert OK: web vitals fără PII (LCP/CLS/INP) trimise de vizitatori pentru monitorizare performanță. Doar INSERT, fără SELECT.';

-- ============================================================================
-- A3: Progressive rate limit pe discover_profiles
-- După 5 cereri/oră, page size cap scade de la 50 la 20.
-- Setting expus în app_settings pentru tunning.
-- ============================================================================

INSERT INTO public.app_settings (key, value, description, updated_by)
VALUES (
  'discover_throttle',
  jsonb_build_object(
    'hard_page_cap', 50,
    'progressive_threshold_calls', 5,
    'progressive_page_cap', 20,
    'window_hours', 1
  ),
  'Rate limit progresiv pe discover_profiles. După progressive_threshold_calls în window_hours, page size scade la progressive_page_cap.',
  NULL
)
ON CONFLICT (key) DO NOTHING;

-- Helper: câte cereri discover a făcut userul în ultima oră
CREATE OR REPLACE FUNCTION public.discover_recent_call_count(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.rate_limit_log
   WHERE user_id = _user
     AND action = 'discover_profiles'
     AND created_at > (now() - interval '1 hour');
$$;
GRANT EXECUTE ON FUNCTION public.discover_recent_call_count(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.discover_recent_call_count(uuid) IS
  'Nr cereri discover_profiles ale userului în ultima oră. Folosit de RPC-ul discover_profiles pentru cap progresiv de page size (anti-scraping).';
