-- Fix mutable search_path on enforce_min_age
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NEW.birthdate IS NOT NULL AND NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Trebuie să ai cel puțin 18 ani pentru a folosi Ventuza.';
  END IF;
  RETURN NEW;
END;
$function$;

-- Drop the old discover_profiles overload (without looking_now_only) — the app uses the newer one.
DROP FUNCTION IF EXISTS public.discover_profiles(
  max_distance_km integer, min_age integer, max_age integer,
  looking_for_filter text[], gender_filter text[], orientation_filter text[],
  tribes_filter text[], body_filter text[], position_filter text[], hiv_filter text[],
  min_height integer, max_height integer, online_only boolean, with_photo_only boolean,
  verified_only boolean, order_mode text, result_limit integer
);

-- Revoke anon EXECUTE on the current discover_profiles — feed is signed-in only.
REVOKE EXECUTE ON FUNCTION public.discover_profiles(
  max_distance_km integer, min_age integer, max_age integer,
  looking_for_filter text[], gender_filter text[], orientation_filter text[],
  tribes_filter text[], body_filter text[], position_filter text[], hiv_filter text[],
  min_height integer, max_height integer, online_only boolean, with_photo_only boolean,
  verified_only boolean, order_mode text, result_limit integer, looking_now_only boolean
) FROM anon, PUBLIC;