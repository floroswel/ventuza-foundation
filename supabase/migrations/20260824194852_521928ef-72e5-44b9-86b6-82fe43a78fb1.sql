-- Funnel instalari: atribuire separata App Links (iOS/Android) vs intent, variante A/B, export si alerte.
ALTER TABLE public.store_funnel_events
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT;

ALTER TABLE public.store_funnel_events DROP CONSTRAINT IF EXISTS store_funnel_events_kind_check;
ALTER TABLE public.store_funnel_events
  ADD CONSTRAINT store_funnel_events_kind_check
  CHECK (kind IN ('store_click','app_open_intent','install_first_open','app_link_open','intent_open'));

CREATE INDEX IF NOT EXISTS store_funnel_events_variant_idx ON public.store_funnel_events (variant, kind);

-- semnatura veche returna void; o inlocuim (fara overload duplicat)
DROP FUNCTION IF EXISTS public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN);

CREATE OR REPLACE FUNCTION public.log_store_funnel_event(
  _kind TEXT,
  _source TEXT DEFAULT NULL,
  _medium TEXT DEFAULT NULL,
  _campaign TEXT DEFAULT NULL,
  _path TEXT DEFAULT NULL,
  _platform TEXT DEFAULT NULL,
  _app_installed BOOLEAN DEFAULT NULL,
  _variant TEXT DEFAULT NULL,
  _referrer TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id BIGINT;
BEGIN
  IF _kind NOT IN ('store_click','app_open_intent','install_first_open','app_link_open','intent_open') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  INSERT INTO public.store_funnel_events (kind, source, medium, campaign, path, platform, app_installed, variant, referrer)
  VALUES (
    _kind,
    left(coalesce(_source, ''), 60),
    left(coalesce(_medium, ''), 60),
    left(coalesce(_campaign, ''), 60),
    left(coalesce(_path, ''), 200),
    left(coalesce(_platform, ''), 30),
    _app_installed,
    left(nullif(_variant, ''), 30),
    left(nullif(_referrer, ''), 300)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT) TO anon, authenticated, service_role;

-- Sumar extins: separam app_link_open (Universal/App Links) de intent_open (Android intent).
DROP FUNCTION IF EXISTS public.admin_store_funnel_summary(INT);
CREATE OR REPLACE FUNCTION public.admin_store_funnel_summary(_days INT DEFAULT 30)
RETURNS TABLE (
  source TEXT,
  variant TEXT,
  platform TEXT,
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
    coalesce(nullif(e.source, ''), 'unknown') AS source,
    coalesce(nullif(e.variant, ''), '-') AS variant,
    coalesce(nullif(e.platform, ''), 'unknown') AS platform,
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_link_open') AS app_link_opens,
    count(*) FILTER (WHERE e.kind IN ('intent_open','app_open_intent')) AS intent_opens,
    count(*) FILTER (WHERE e.kind = 'install_first_open') AS installs
  FROM public.store_funnel_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(365, _days)))
    AND public.is_staff(auth.uid())
  GROUP BY 1, 2, 3
  ORDER BY 4 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_store_funnel_summary(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_summary(INT) TO authenticated, service_role;

-- Export pentru interval de date alese (folosit pentru CSV in admin).
CREATE OR REPLACE FUNCTION public.admin_store_funnel_export(_from DATE, _to DATE)
RETURNS TABLE (
  day DATE,
  source TEXT,
  variant TEXT,
  platform TEXT,
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
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_link_open') AS app_link_opens,
    count(*) FILTER (WHERE e.kind IN ('intent_open','app_open_intent')) AS intent_opens,
    count(*) FILTER (WHERE e.kind = 'install_first_open') AS installs
  FROM public.store_funnel_events e
  WHERE e.created_at >= _from::timestamptz
    AND e.created_at < (_to + 1)::timestamptz
    AND public.is_staff(auth.uid())
  GROUP BY 1, 2, 3, 4
  ORDER BY 1 DESC, 5 DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_store_funnel_export(DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_export(DATE,DATE) TO authenticated, service_role;

-- Praguri de alerta, gestionate din admin (app_settings, nu hardcodat in cod).
INSERT INTO public.app_settings(key, value, category, description) VALUES
  ('store_funnel_alerts',
   '{"window_days": 7, "min_events": 20, "min_conversion_pct": 5, "min_installs": 3}'::jsonb,
   'growth',
   'Praguri de alerta pentru funnel-ul web -> instalare (evenimente minime, rata minima de conversie, instalari minime pe fereastra).')
ON CONFLICT (key) DO NOTHING;

-- Evaluarea alertelor (citita in panoul admin).
CREATE OR REPLACE FUNCTION public.admin_store_funnel_alerts()
RETURNS TABLE (
  code TEXT,
  severity TEXT,
  message TEXT,
  observed NUMERIC,
  threshold NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg JSONB;
  w INT;
  min_events INT;
  min_cvr NUMERIC;
  min_installs INT;
  n_events BIGINT;
  n_clicks BIGINT;
  n_installs BIGINT;
  cvr NUMERIC;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'store_funnel_alerts';
  cfg := coalesce(cfg, '{}'::jsonb);
  w := greatest(1, coalesce((cfg->>'window_days')::int, 7));
  min_events := greatest(0, coalesce((cfg->>'min_events')::int, 20));
  min_cvr := greatest(0, coalesce((cfg->>'min_conversion_pct')::numeric, 5));
  min_installs := greatest(0, coalesce((cfg->>'min_installs')::int, 3));

  SELECT count(*),
         count(*) FILTER (WHERE kind = 'store_click'),
         count(*) FILTER (WHERE kind = 'install_first_open')
    INTO n_events, n_clicks, n_installs
  FROM public.store_funnel_events
  WHERE created_at > now() - make_interval(days => w);

  cvr := CASE WHEN n_clicks > 0 THEN round((n_installs::numeric / n_clicks) * 100, 2) ELSE 0 END;

  IF n_events < min_events THEN
    RETURN QUERY SELECT 'low_event_volume', 'warning',
      format('Doar %s evenimente de funnel in ultimele %s zile — posibila problema de tracking.', n_events, w),
      n_events::numeric, min_events::numeric;
  END IF;

  IF n_clicks > 0 AND cvr < min_cvr THEN
    RETURN QUERY SELECT 'low_conversion', 'critical',
      format('Rata de conversie click -> instalare este %s%% (prag %s%%).', cvr, min_cvr),
      cvr, min_cvr;
  END IF;

  IF n_installs < min_installs THEN
    RETURN QUERY SELECT 'low_installs', 'warning',
      format('Doar %s instalari confirmate in ultimele %s zile (prag %s).', n_installs, w, min_installs),
      n_installs::numeric, min_installs::numeric;
  END IF;

  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_store_funnel_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_alerts() TO authenticated, service_role;