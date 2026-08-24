-- Funnel web -> instalare Play Store. Date strict anonime (fara user_id, fara IP).
CREATE TABLE IF NOT EXISTS public.store_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('store_click','app_open_intent','install_first_open')),
  source TEXT,
  medium TEXT,
  campaign TEXT,
  path TEXT,
  platform TEXT,
  app_installed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_funnel_events_created_idx ON public.store_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS store_funnel_events_kind_idx ON public.store_funnel_events (kind, source);

GRANT ALL ON public.store_funnel_events TO service_role;
ALTER TABLE public.store_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_funnel_staff_read" ON public.store_funnel_events;
CREATE POLICY "store_funnel_staff_read" ON public.store_funnel_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Scriere doar prin RPC (fara insert direct din client).
CREATE OR REPLACE FUNCTION public.log_store_funnel_event(
  _kind TEXT,
  _source TEXT DEFAULT NULL,
  _medium TEXT DEFAULT NULL,
  _campaign TEXT DEFAULT NULL,
  _path TEXT DEFAULT NULL,
  _platform TEXT DEFAULT NULL,
  _app_installed BOOLEAN DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind NOT IN ('store_click','app_open_intent','install_first_open') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  INSERT INTO public.store_funnel_events (kind, source, medium, campaign, path, platform, app_installed)
  VALUES (
    _kind,
    left(coalesce(_source, ''), 60),
    left(coalesce(_medium, ''), 60),
    left(coalesce(_campaign, ''), 60),
    left(coalesce(_path, ''), 200),
    left(coalesce(_platform, ''), 30),
    _app_installed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN) TO anon, authenticated, service_role;

-- Sumar pentru admin.
CREATE OR REPLACE FUNCTION public.admin_store_funnel_summary(_days INT DEFAULT 30)
RETURNS TABLE (source TEXT, clicks BIGINT, app_opens BIGINT, installs BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(nullif(e.source, ''), 'unknown') AS source,
    count(*) FILTER (WHERE e.kind = 'store_click') AS clicks,
    count(*) FILTER (WHERE e.kind = 'app_open_intent') AS app_opens,
    count(*) FILTER (WHERE e.kind = 'install_first_open') AS installs
  FROM public.store_funnel_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(365, _days)))
    AND public.is_staff(auth.uid())
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_store_funnel_summary(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_funnel_summary(INT) TO authenticated, service_role;