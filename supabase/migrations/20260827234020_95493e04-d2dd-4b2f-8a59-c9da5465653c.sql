-- 1. Gate is_staff pe rapoartele funnel (erau LANGUAGE sql, fara nicio verificare)
CREATE OR REPLACE FUNCTION public.admin_store_funnel_summary(_days integer DEFAULT 30)
RETURNS TABLE(source text, variant text, platform text, clicks bigint, app_link_opens bigint, intent_opens bigint, installs bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: staff role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    coalesce(nullif(e.source, ''), 'unknown')::text AS source,
    coalesce(nullif(e.variant, ''), '-')::text AS variant,
    coalesce(nullif(e.platform, ''), 'unknown')::text AS platform,
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_link_open') AS app_link_opens,
    count(*) FILTER (WHERE e.kind IN ('intent_open','app_open_intent')) AS intent_opens,
    count(*) FILTER (WHERE e.kind = 'install') AS installs
  FROM public.store_funnel_events e
  WHERE e.created_at >= now() - make_interval(days => greatest(1, _days))
  GROUP BY 1,2,3
  ORDER BY clicks DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_store_funnel_export(_from date, _to date)
RETURNS TABLE(day date, source text, variant text, platform text, os_name text, browser text, clicks bigint, app_link_opens bigint, intent_opens bigint, installs bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: staff role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (e.created_at AT TIME ZONE 'UTC')::date AS day,
    coalesce(nullif(e.source, ''), 'unknown')::text AS source,
    coalesce(nullif(e.variant, ''), '-')::text AS variant,
    coalesce(nullif(e.platform, ''), 'unknown')::text AS platform,
    coalesce(nullif(e.os_name, ''), 'unknown')::text AS os_name,
    coalesce(nullif(e.browser, ''), 'unknown')::text AS browser,
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_link_open') AS app_link_opens,
    count(*) FILTER (WHERE e.kind IN ('intent_open','app_open_intent')) AS intent_opens,
    count(*) FILTER (WHERE e.kind = 'install') AS installs
  FROM public.store_funnel_events e
  WHERE (e.created_at AT TIME ZONE 'UTC')::date >= _from
    AND (e.created_at AT TIME ZONE 'UTC')::date <= _to
  GROUP BY 1,2,3,4,5,6
  ORDER BY 1 DESC, clicks DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_store_funnel_export_raw(_from date, _to date, _limit integer DEFAULT 5000)
RETURNS TABLE(created_at timestamp with time zone, kind text, source text, medium text, campaign text, variant text, platform text, os_name text, browser text, user_agent text, referrer text, referrer_url text, path text, app_installed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: staff role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    e.created_at,
    e.kind::text,
    coalesce(nullif(e.source, ''), 'unknown')::text,
    e.medium::text,
    e.campaign::text,
    coalesce(nullif(e.variant, ''), '-')::text,
    coalesce(nullif(e.platform, ''), 'unknown')::text,
    coalesce(nullif(e.os_name, ''), 'unknown')::text,
    coalesce(nullif(e.browser, ''), 'unknown')::text,
    e.user_agent::text,
    e.referrer::text,
    e.referrer_url::text,
    e.path::text,
    e.app_installed
  FROM public.store_funnel_events e
  WHERE (e.created_at AT TIME ZONE 'UTC')::date >= _from
    AND (e.created_at AT TIME ZONE 'UTC')::date <= _to
  ORDER BY e.created_at DESC
  LIMIT greatest(1, least(_limit, 50000));
END;
$function$;

-- 2. Revoca EXECUTE de la anon (idempotent)
REVOKE EXECUTE ON FUNCTION public.admin_store_funnel_summary(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_store_funnel_export(date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_store_funnel_export_raw(date, date, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_store_funnel_alerts() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_grant_abuse_alerts(integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_store_funnel_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_export(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_export_raw(date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_abuse_alerts(integer) TO authenticated;

-- 3. Functii de trigger: nu trebuie apelabile direct de nimeni din API
REVOKE EXECUTE ON FUNCTION public.enforce_profile_completion_rules() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wallet_qualify_on_verify() FROM anon, authenticated, public;