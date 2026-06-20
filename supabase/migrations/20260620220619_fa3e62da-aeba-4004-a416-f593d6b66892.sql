
-- Revoke SECURITY DEFINER fns from anon/public
REVOKE EXECUTE ON FUNCTION public.update_my_location(double precision, double precision) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, uuid, notification_type, text, text, text, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.update_my_location(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;

-- discover_profiles: revoke from anon, keep for authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid, pg_get_function_identity_arguments(p.oid) as args
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='discover_profiles'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.discover_profiles(%s) FROM anon, public', r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.discover_profiles(%s) TO authenticated', r.args);
  END LOOP;
END $$;

-- event_rsvps INSERT tighten
DROP POLICY IF EXISTS "Authenticated users can create their own rsvps" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can create their own rsvps" ON public.event_rsvps;
CREATE POLICY "Users RSVP only to events they can see"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND (e.is_private = false OR e.host_id = auth.uid())
    )
  );

-- Swipe rate limit via trigger BEFORE INSERT
CREATE OR REPLACE FUNCTION public.enforce_swipe_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.swipes
    WHERE swiper_id = NEW.swiper_id AND created_at > now() - interval '24 hours';
  IF _count >= 200 THEN
    RAISE EXCEPTION 'Daily swipe limit reached (200/day). Try again tomorrow.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS swipe_rate_limit ON public.swipes;
CREATE TRIGGER swipe_rate_limit BEFORE INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_swipe_rate_limit();
