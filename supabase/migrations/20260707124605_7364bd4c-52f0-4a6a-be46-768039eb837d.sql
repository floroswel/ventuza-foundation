
REVOKE ALL ON public.notification_dispatch_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_audit_log          FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.notification_dispatch_log TO authenticated;
GRANT SELECT ON public.admin_audit_log          TO authenticated;

GRANT ALL ON public.notification_dispatch_log TO service_role;
GRANT ALL ON public.admin_audit_log          TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notification_dispatch_log_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq          TO service_role;

ALTER TABLE public.notification_dispatch_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log          FORCE ROW LEVEL SECURITY;

-- Politici restrictive: PostgreSQL cere `CREATE POLICY name ON table AS RESTRICTIVE FOR ...`
DROP POLICY IF EXISTS "client_no_insert_dispatch" ON public.notification_dispatch_log;
CREATE POLICY "client_no_insert_dispatch" ON public.notification_dispatch_log
  AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false);

DROP POLICY IF EXISTS "client_no_update_dispatch" ON public.notification_dispatch_log;
CREATE POLICY "client_no_update_dispatch" ON public.notification_dispatch_log
  AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "client_no_delete_dispatch" ON public.notification_dispatch_log;
CREATE POLICY "client_no_delete_dispatch" ON public.notification_dispatch_log
  AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

DROP POLICY IF EXISTS "client_no_insert_audit" ON public.admin_audit_log;
CREATE POLICY "client_no_insert_audit" ON public.admin_audit_log
  AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false);

DROP POLICY IF EXISTS "client_no_update_audit" ON public.admin_audit_log;
CREATE POLICY "client_no_update_audit" ON public.admin_audit_log
  AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "client_no_delete_audit" ON public.admin_audit_log;
CREATE POLICY "client_no_delete_audit" ON public.admin_audit_log
  AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

REVOKE ALL ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_notification_dispatch(uuid, uuid, text, text, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.purge_notification_dispatch_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_notification_dispatch_log() TO service_role;

REVOKE ALL ON FUNCTION public.purge_admin_audit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_admin_audit_log() TO service_role;

REVOKE ALL ON FUNCTION public.run_audit_retention_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_audit_retention_purge() TO service_role;

REVOKE ALL ON FUNCTION public.admin_log_notification_access(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_notification_access(uuid, integer, text) TO authenticated;
