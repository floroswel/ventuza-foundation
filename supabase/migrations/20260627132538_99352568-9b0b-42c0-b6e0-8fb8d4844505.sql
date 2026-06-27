CREATE OR REPLACE FUNCTION public.app_role_values()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(v::text ORDER BY v::text)
  FROM unnest(enum_range(NULL::public.app_role)) AS v;
$$;

REVOKE ALL ON FUNCTION public.app_role_values() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_role_values() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.app_role_values() IS
  'Returnează valorile enum-ului app_role. Folosit de testul de integrare pentru a preveni regresia eroare „invalid input value for enum app_role: partner".';
