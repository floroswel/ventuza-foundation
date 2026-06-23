
-- 1) Revoke anon execute on internal trigger / helper functions
REVOKE EXECUTE ON FUNCTION public.is_fingerprint_banned(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_profile_live_event() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_event_rsvp() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_match() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_message_sent() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_profile_view() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_story_post() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_quest_tap() FROM anon, public;

-- 2) Tighten ad_events insert policy (was WITH CHECK true)
DROP POLICY IF EXISTS ad_events_auth_insert ON public.ad_events;
CREATE POLICY ad_events_auth_insert ON public.ad_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
