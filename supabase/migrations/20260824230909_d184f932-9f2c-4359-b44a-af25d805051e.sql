ALTER TABLE public.store_funnel_events DROP CONSTRAINT IF EXISTS store_funnel_events_kind_check;
ALTER TABLE public.store_funnel_events
  ADD CONSTRAINT store_funnel_events_kind_check
  CHECK (kind IN ('store_click','app_open_intent','install_first_open','app_link_open','intent_open','deferred_deeplink_open'));

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
  IF _kind NOT IN ('store_click','app_open_intent','install_first_open','app_link_open','intent_open','deferred_deeplink_open') THEN
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