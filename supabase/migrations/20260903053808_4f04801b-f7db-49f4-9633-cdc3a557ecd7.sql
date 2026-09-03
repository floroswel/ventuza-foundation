-- 1) get_country_risk devine SECURITY DEFINER (returnează doar o țară)
CREATE OR REPLACE FUNCTION public.get_country_risk(_country_code text)
 RETURNS TABLE(country_code text, risk_level text, hide_precise_location boolean, force_stealth boolean, disable_discover boolean, disable_signup boolean, reason text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.country_code, c.risk_level, c.hide_precise_location, c.force_stealth,
         c.disable_discover, c.disable_signup, c.reason
  FROM public.country_risk_config c
  WHERE c.country_code = upper(coalesce(_country_code, ''))
  LIMIT 1
$function$;

-- 2) tabelul brut nu mai e lizibil de anon/authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='country_risk_config' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.country_risk_config', r.policyname);
  END LOOP;
END $$;

REVOKE SELECT ON public.country_risk_config FROM anon, authenticated;

CREATE POLICY "country_risk_config staff read"
ON public.country_risk_config FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.country_risk_config TO authenticated;
GRANT ALL ON public.country_risk_config TO service_role;

-- 3) app_settings: allowlist explicit în loc de denylist
DROP POLICY IF EXISTS "app_settings public-safe keys" ON public.app_settings;

CREATE POLICY "app_settings public-safe allowlist"
ON public.app_settings FOR SELECT TO authenticated
USING (
  key IN ('performance_settings','i18n_overrides','min_supported_version','proximity_notifications')
  OR public.is_staff(auth.uid())
);