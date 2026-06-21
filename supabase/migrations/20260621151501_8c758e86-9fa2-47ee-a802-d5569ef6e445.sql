
REVOKE EXECUTE ON FUNCTION public.unsend_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsend_message(uuid) TO authenticated;
