
CREATE OR REPLACE FUNCTION public.admin_revenue_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_prices jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(value->'prices', '{}'::jsonb) INTO v_prices
    FROM public.app_settings WHERE key = 'billing_settings';

  WITH plan_prices AS (
    SELECT pp.code,
           COALESCE(((v_prices -> pp.code) ->> 'monthly_minor')::numeric, 0) / 100.0 AS monthly_ron
      FROM public.partner_plans pp
  ),
  active_subs AS (
    SELECT s.owner_id, s.plan_code, s.status, s.current_period_end,
           COALESCE(p.monthly_ron, 0) AS monthly_ron
      FROM public.partner_subscriptions s
      LEFT JOIN plan_prices p ON p.code = s.plan_code
     WHERE s.status IN ('active','grace')
  ),
  invoices_30d AS (
    SELECT SUM(total_cents)::bigint AS cents
      FROM public.partner_invoices
     WHERE status = 'paid' AND paid_at > now() - interval '30 days'
  ),
  invoices_365d AS (
    SELECT SUM(total_cents)::bigint AS cents
      FROM public.partner_invoices
     WHERE status = 'paid' AND paid_at > now() - interval '365 days'
  )
  SELECT jsonb_build_object(
    'mrr_ron', COALESCE((SELECT SUM(monthly_ron) FROM active_subs), 0),
    'arr_ron', COALESCE((SELECT SUM(monthly_ron) FROM active_subs), 0) * 12,
    'active_subs', (SELECT COUNT(*) FROM active_subs),
    'active_subs_by_plan', COALESCE(
      (SELECT jsonb_object_agg(plan_code, cnt)
         FROM (SELECT plan_code, COUNT(*) cnt FROM active_subs GROUP BY plan_code) t),
      '{}'::jsonb),
    'grace_subs', (SELECT COUNT(*) FROM active_subs WHERE status = 'grace'),
    'revenue_30d_ron', COALESCE((SELECT cents FROM invoices_30d), 0) / 100.0,
    'revenue_365d_ron', COALESCE((SELECT cents FROM invoices_365d), 0) / 100.0,
    'invoices_unpaid_overdue', (
      SELECT COUNT(*) FROM public.partner_invoices
       WHERE status IN ('pending_payment','overdue') AND due_at < now()
    ),
    'churned_last_30d', (
      SELECT COUNT(*) FROM public.partner_subscriptions
       WHERE status IN ('cancelled','free_downgraded')
         AND current_period_end > now() - interval '30 days'
    )
  ) INTO v_result;

  RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_retention_cohorts(_days integer DEFAULT 30)
 RETURNS TABLE(cohort_day date, signups integer, d1 integer, d7 integer, d30 integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT date_trunc('day', created_at)::date AS d, id
      FROM public.profiles
     WHERE created_at > now() - make_interval(days => _days + 30)
  ),
  activity AS (
    SELECT p.id, p.updated_at AS last_active
      FROM public.profiles p
  )
  SELECT c.d AS cohort_day,
         COUNT(*)::int AS signups,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '1 day'
             AND a.last_active <  c.d + interval '2 day'
         )::int AS d1,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '7 day'
             AND a.last_active <  c.d + interval '8 day'
         )::int AS d7,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '30 day'
             AND a.last_active <  c.d + interval '31 day'
         )::int AS d30
    FROM cohorts c
    LEFT JOIN activity a ON a.id = c.id
   WHERE c.d >= (CURRENT_DATE - _days)
   GROUP BY c.d
   ORDER BY c.d DESC;
END $function$;
