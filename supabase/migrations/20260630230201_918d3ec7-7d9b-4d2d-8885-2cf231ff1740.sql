REVOKE ALL ON FUNCTION public.nearby_points(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_points(text, text[]) TO authenticated, service_role;