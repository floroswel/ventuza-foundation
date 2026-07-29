
-- Harden trigger/helper functions: pin search_path and revoke anon/public EXECUTE

ALTER FUNCTION public.prevent_audit_mutation() SET search_path = public;
ALTER FUNCTION public.prevent_dispatch_log_mutation() SET search_path = public;

-- Trigger functions: no direct callers; revoke stray anon/public EXECUTE
REVOKE EXECUTE ON FUNCTION public.trg_rl_report() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_rl_send_message() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_rl_sos_log_only() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_rl_swipe() FROM PUBLIC, anon;

-- Helper: called by discover_profiles (SECURITY DEFINER cascades); no direct client use
REVOKE EXECUTE ON FUNCTION public.discover_recent_call_count(uuid) FROM PUBLIC, anon;
