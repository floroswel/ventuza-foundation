-- 1) get_country_risk: nu are nevoie de SECURITY DEFINER (tabelul are politică publică de citire)
CREATE OR REPLACE FUNCTION public.get_country_risk(_country_code text)
 RETURNS TABLE(country_code text, risk_level text, hide_precise_location boolean, force_stealth boolean, disable_discover boolean, disable_signup boolean, reason text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT c.country_code, c.risk_level, c.hide_precise_location, c.force_stealth,
         c.disable_discover, c.disable_signup, c.reason
  FROM public.country_risk_config c
  WHERE c.country_code = upper(coalesce(_country_code, ''))
  LIMIT 1
$function$;

-- 2) Trigger function internă — nu trebuie apelabilă din Data API
REVOKE ALL ON FUNCTION public.guardian_events_immutable() FROM PUBLIC, anon, authenticated;

-- 3) Utilitare PostGIS SECURITY DEFINER — fără acces anonim
REVOKE ALL ON FUNCTION public.st_estimatedextent(text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.st_estimatedextent(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.st_estimatedextent(text,text) FROM PUBLIC, anon;