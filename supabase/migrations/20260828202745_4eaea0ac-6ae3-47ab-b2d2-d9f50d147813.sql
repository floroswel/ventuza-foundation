REVOKE ALL ON FUNCTION public.prevent_profile_privileged_self_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_profile_privileged_self_update() TO service_role;