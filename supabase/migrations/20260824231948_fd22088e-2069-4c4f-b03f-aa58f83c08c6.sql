INSERT INTO public.app_settings (key, value, description)
VALUES (
  'grant_abuse_thresholds',
  jsonb_build_object(
    'window_hours', 24,
    'max_grants_per_actor', 15,
    'max_amount_cents_per_actor', 50000,
    'max_grants_same_target', 3,
    'night_hour_start', 1,
    'night_hour_end', 5
  ),
  'Praguri pentru alertele de abuz la acordări/compensații (admin_grants).'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_grant_abuse_alerts(_days INT DEFAULT 7)
RETURNS TABLE (
  code TEXT,
  severity TEXT,
  actor_id UUID,
  target_user_id UUID,
  observed NUMERIC,
  threshold NUMERIC,
  message TEXT,
  last_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg JSONB;
  win INTERVAL;
  since TIMESTAMPTZ;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT value INTO cfg FROM public.app_settings WHERE key = 'grant_abuse_thresholds';
  cfg := coalesce(cfg, '{}'::jsonb);
  win := make_interval(hours => coalesce((cfg->>'window_hours')::int, 24));
  since := now() - make_interval(days => greatest(1, least(90, coalesce(_days, 7))));

  RETURN QUERY
  -- 1. Prea multe acordari per moderator in fereastra
  SELECT
    'grants_burst_actor'::TEXT,
    'warning'::TEXT,
    g.actor_id,
    NULL::UUID,
    count(*)::NUMERIC,
    coalesce((cfg->>'max_grants_per_actor')::numeric, 15),
    format('%s acordări în ultimele %s ore', count(*), coalesce((cfg->>'window_hours')::int, 24)),
    max(g.created_at)
  FROM public.admin_grants g
  WHERE g.created_at >= now() - win
  GROUP BY g.actor_id
  HAVING count(*) > coalesce((cfg->>'max_grants_per_actor')::numeric, 15)

  UNION ALL
  -- 2. Suma acordata prea mare per moderator
  SELECT
    'grants_amount_actor'::TEXT,
    'critical'::TEXT,
    g.actor_id,
    NULL::UUID,
    coalesce(sum(g.amount_cents), 0)::NUMERIC,
    coalesce((cfg->>'max_amount_cents_per_actor')::numeric, 50000),
    format('%s bani acordați (cenți) în fereastra curentă', coalesce(sum(g.amount_cents), 0)),
    max(g.created_at)
  FROM public.admin_grants g
  WHERE g.created_at >= now() - win
  GROUP BY g.actor_id
  HAVING coalesce(sum(g.amount_cents), 0) > coalesce((cfg->>'max_amount_cents_per_actor')::numeric, 50000)

  UNION ALL
  -- 3. Acordari repetate catre acelasi utilizator de la acelasi moderator
  SELECT
    'grants_repeat_target'::TEXT,
    'warning'::TEXT,
    g.actor_id,
    g.target_user_id,
    count(*)::NUMERIC,
    coalesce((cfg->>'max_grants_same_target')::numeric, 3),
    format('%s acordări către același utilizator', count(*)),
    max(g.created_at)
  FROM public.admin_grants g
  WHERE g.created_at >= since
  GROUP BY g.actor_id, g.target_user_id
  HAVING count(*) > coalesce((cfg->>'max_grants_same_target')::numeric, 3)

  UNION ALL
  -- 4. Acordari in intervalul de noapte
  SELECT
    'grants_night_activity'::TEXT,
    'info'::TEXT,
    g.actor_id,
    NULL::UUID,
    count(*)::NUMERIC,
    0::NUMERIC,
    format('%s acordări în intervalul de noapte', count(*)),
    max(g.created_at)
  FROM public.admin_grants g
  WHERE g.created_at >= since
    AND extract(hour FROM (g.created_at AT TIME ZONE 'Europe/Bucharest'))
        BETWEEN coalesce((cfg->>'night_hour_start')::int, 1) AND coalesce((cfg->>'night_hour_end')::int, 5)
  GROUP BY g.actor_id
  HAVING count(*) > 0

  ORDER BY 2, 8 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_abuse_alerts(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_abuse_alerts(INT) TO authenticated, service_role;