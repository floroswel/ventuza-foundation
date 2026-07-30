REVOKE ALL ON FUNCTION public.didit_link_session(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.didit_link_session(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.didit_link_session(text, text, text) TO service_role;