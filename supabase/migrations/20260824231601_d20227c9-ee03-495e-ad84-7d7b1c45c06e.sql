ALTER TABLE public.store_funnel_events
  ADD COLUMN IF NOT EXISTS referrer_url TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS os_name TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT;

CREATE OR REPLACE FUNCTION public.log_store_funnel_event(
  _kind TEXT,
  _source TEXT DEFAULT NULL,
  _medium TEXT DEFAULT NULL,
  _campaign TEXT DEFAULT NULL,
  _path TEXT DEFAULT NULL,
  _platform TEXT DEFAULT NULL,
  _app_installed BOOLEAN DEFAULT NULL,
  _variant TEXT DEFAULT NULL,
  _referrer TEXT DEFAULT NULL,
  _dedupe_key TEXT DEFAULT NULL,
  _referrer_url TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _os_name TEXT DEFAULT NULL,
  _browser TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_key TEXT := left(nullif(_dedupe_key, ''), 120);
BEGIN
  IF _kind NOT IN ('store_click','app_open_intent','install_first_open','app_link_open','intent_open','deferred_deeplink_open') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.store_funnel_events WHERE dedupe_key = v_key;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.store_funnel_events (
    kind, source, medium, campaign, path, platform, app_installed, variant, referrer, dedupe_key,
    referrer_url, user_agent, os_name, browser
  )
  VALUES (
    _kind,
    left(coalesce(_source, ''), 60),
    left(coalesce(_medium, ''), 60),
    left(coalesce(_campaign, ''), 60),
    left(coalesce(_path, ''), 200),
    left(coalesce(_platform, ''), 30),
    _app_installed,
    left(nullif(_variant, ''), 30),
    left(nullif(_referrer, ''), 300),
    v_key,
    left(nullif(_referrer_url, ''), 300),
    left(nullif(_user_agent, ''), 200),
    left(nullif(_os_name, ''), 40),
    left(nullif(_browser, ''), 40)
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL AND v_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.store_funnel_events WHERE dedupe_key = v_key;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT);

-- Export agregat: adaugam OS si browser in defalcare.
DROP FUNCTION IF EXISTS public.admin_store_funnel_export(DATE,DATE);
CREATE OR REPLACE FUNCTION public.admin_store_funnel_export(_from DATE, _to DATE)
RETURNS TABLE (
  day DATE,
  source TEXT,
  variant TEXT,
  platform TEXT,
  os_name TEXT,
  browser TEXT,
  clicks BIGINT,
  app_link_opens BIGINT,
  intent_opens BIGINT,
  installs BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (e.created_at AT TIME ZONE 'UTC')::date AS day,
    coalesce(nullif(e.source, ''), 'unknown') AS source,
    coalesce(nullif(e.variant, ''), '-') AS variant,
    coalesce(nullif(e.platform, ''), 'unknown') AS platform,
    coalesce(nullif(e.os_name, ''), 'unknown') AS os_name,
    coalesce(nullif(e.browser, ''), 'unknown') AS browser,
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_link_open') AS app_link_opens,
    count(*) FILTER (WHERE e.kind IN ('intent_open','app_open_intent')) AS intent_opens,
    count(*) FILTER (WHERE e.kind = 'install_first_open') AS installs
  FROM public.store_funnel_events e
  WHERE e.created_at >= _from::timestamptz
    AND e.created_at < (_to + 1)::timestamptz
    AND public.is_staff(auth.uid())
  GROUP BY 1, 2, 3, 4, 5, 6
  ORDER BY 1 DESC, 7 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_store_funnel_export(DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_export(DATE,DATE) TO authenticated, service_role;

-- Export detaliat: un rand per eveniment (max 20.000), doar staff.
CREATE OR REPLACE FUNCTION public.admin_store_funnel_export_raw(_from DATE, _to DATE, _limit INT DEFAULT 5000)
RETURNS TABLE (
  created_at TIMESTAMPTZ,
  kind TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  variant TEXT,
  platform TEXT,
  os_name TEXT,
  browser TEXT,
  user_agent TEXT,
  referrer TEXT,
  referrer_url TEXT,
  path TEXT,
  app_installed BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.created_at,
    e.kind,
    coalesce(nullif(e.source, ''), 'unknown'),
    e.medium,
    e.campaign,
    coalesce(nullif(e.variant, ''), '-'),
    coalesce(nullif(e.platform, ''), 'unknown'),
    coalesce(nullif(e.os_name, ''), 'unknown'),
    coalesce(nullif(e.browser, ''), 'unknown'),
    e.user_agent,
    e.referrer,
    e.referrer_url,
    e.path,
    e.app_installed
  FROM public.store_funnel_events e
  WHERE e.created_at >= _from::timestamptz
    AND e.created_at < (_to + 1)::timestamptz
    AND public.is_staff(auth.uid())
  ORDER BY e.created_at DESC
  LIMIT greatest(1, least(20000, coalesce(_limit, 5000)));
$$;
REVOKE ALL ON FUNCTION public.admin_store_funnel_export_raw(DATE,DATE,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_export_raw(DATE,DATE,INT) TO authenticated, service_role;