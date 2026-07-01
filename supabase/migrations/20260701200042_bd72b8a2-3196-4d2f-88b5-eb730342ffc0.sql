
REVOKE EXECUTE ON FUNCTION public.admin_revenue_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_retention_cohorts(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_funnel_stats(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_staff_ticket_action(uuid, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_decide_appeal(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ticket_touch_on_msg() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_impers_mutation() FROM PUBLIC;
