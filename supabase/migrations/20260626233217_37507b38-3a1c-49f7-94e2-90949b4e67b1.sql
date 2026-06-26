
-- Partner quota helper + seed defaults
CREATE OR REPLACE FUNCTION public.partner_get_quota_usage(p_user uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'venues', (SELECT count(*) FROM public.venues WHERE owner_id = p_user),
    'events', (SELECT count(*) FROM public.events WHERE host_id = p_user),
    'offers', (
      SELECT count(*) FROM public.offers o
      JOIN public.venues v ON v.id = o.venue_id
      WHERE v.owner_id = p_user
    ),
    'drafts_last_hour', (
      SELECT
        (SELECT count(*) FROM public.venues WHERE owner_id = p_user AND created_at > now() - interval '1 hour')
      + (SELECT count(*) FROM public.events WHERE host_id = p_user AND created_at > now() - interval '1 hour')
      + (SELECT count(*) FROM public.offers o
         JOIN public.venues v ON v.id = o.venue_id
         WHERE v.owner_id = p_user AND o.created_at > now() - interval '1 hour')
    ),
    'quotas', COALESCE((SELECT value FROM public.app_settings WHERE key = 'partner_quotas'), '{}'::jsonb),
    'suspended', EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_user AND partner_suspended_at IS NOT NULL
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.partner_get_quota_usage(uuid) TO authenticated, service_role;

INSERT INTO public.app_settings(key, value, description)
VALUES (
  'partner_quotas',
  '{"max_venues":10,"max_events":50,"max_active_offers":20,"max_drafts_per_hour":5}'::jsonb,
  'Limite per partener (creare resurse + rate limit drafts)'
)
ON CONFLICT (key) DO NOTHING;
