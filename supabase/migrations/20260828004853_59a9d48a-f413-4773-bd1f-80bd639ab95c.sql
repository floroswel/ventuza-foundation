-- Fix: ambele funcții fac INSERT în public.rate_limit_log, deci nu pot fi
-- STABLE. Postgres refuza apelul cu 0A000 "INSERT is not allowed in a
-- non-volatile function" ori de câte ori lista de id-uri nu era goală.
-- Volatilitatea se poate schimba prin CREATE OR REPLACE (tipul returnat rămâne
-- identic), deci nu e nevoie de DROP.

ALTER FUNCTION public.get_public_profiles(uuid[]) VOLATILE;
ALTER FUNCTION public.list_visible_profiles(uuid[]) VOLATILE;