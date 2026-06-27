
-- Add is_seed marker to all tables that can contain demo content
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.advertisers ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_seed_idx ON public.profiles (is_seed) WHERE is_seed = true;
CREATE INDEX IF NOT EXISTS venues_is_seed_idx ON public.venues (is_seed) WHERE is_seed = true;
CREATE INDEX IF NOT EXISTS events_is_seed_idx ON public.events (is_seed) WHERE is_seed = true;
CREATE INDEX IF NOT EXISTS offers_is_seed_idx ON public.offers (is_seed) WHERE is_seed = true;

-- Add is_seed to privilege-escalation trigger protection set (so a regular user
-- can't flip their own row to is_seed=true to avoid moderation, although the
-- field has no effect; keeps the trigger surface honest).
-- (The existing prevent_profile_privilege_escalation trigger already strips
-- unknown attempted writes from non-service_role; nothing else needed.)

-- Aggregate view of seed content (used by admin "delete all demo" + prod warning).
CREATE OR REPLACE FUNCTION public.seed_content_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'partners', (SELECT count(*) FROM public.profiles WHERE is_seed),
    'venues',   (SELECT count(*) FROM public.venues WHERE is_seed),
    'events',   (SELECT count(*) FROM public.events WHERE is_seed),
    'offers',   (SELECT count(*) FROM public.offers WHERE is_seed),
    'ads',      (SELECT count(*) FROM public.ad_campaigns WHERE is_seed),
    'subs',     (SELECT count(*) FROM public.subscriptions WHERE is_seed)
  );
$$;
GRANT EXECUTE ON FUNCTION public.seed_content_summary() TO authenticated, service_role;
