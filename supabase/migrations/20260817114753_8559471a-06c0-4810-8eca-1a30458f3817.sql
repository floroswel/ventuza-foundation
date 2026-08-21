CREATE OR REPLACE FUNCTION public.public_partner_pricing()
RETURNS TABLE (
  code text,
  name text,
  description text,
  entitlements jsonb,
  sort_order integer,
  monthly_minor integer,
  currency text,
  vat_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.code,
    p.name,
    p.description,
    p.entitlements,
    p.sort_order,
    NULLIF((s.value -> 'prices' -> p.code ->> 'monthly_minor'), '')::int AS monthly_minor,
    COALESCE(s.value ->> 'currency', 'RON') AS currency,
    COALESCE((s.value ->> 'vat_rate')::numeric, 19) AS vat_rate
  FROM public.partner_plans p
  LEFT JOIN public.app_settings s ON s.key = 'billing_settings'
  WHERE p.active = true
  ORDER BY p.sort_order
$$;

REVOKE ALL ON FUNCTION public.public_partner_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_partner_pricing() TO anon, authenticated, service_role;