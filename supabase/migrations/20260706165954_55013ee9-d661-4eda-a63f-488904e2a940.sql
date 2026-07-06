REVOKE ALL ON public.message_locations FROM PUBLIC;
REVOKE ALL ON public.message_locations FROM anon;
REVOKE ALL ON public.message_locations FROM authenticated;
GRANT ALL ON public.message_locations TO service_role;