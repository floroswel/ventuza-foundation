ALTER TABLE public.store_funnel_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS store_funnel_events_dedupe_key_uidx
  ON public.store_funnel_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

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
  _dedupe_key TEXT DEFAULT NULL
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

  INSERT INTO public.store_funnel_events (kind, source, medium, campaign, path, platform, app_installed, variant, referrer, dedupe_key)
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
    v_key
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL AND v_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.store_funnel_events WHERE dedupe_key = v_key;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.log_store_funnel_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT);