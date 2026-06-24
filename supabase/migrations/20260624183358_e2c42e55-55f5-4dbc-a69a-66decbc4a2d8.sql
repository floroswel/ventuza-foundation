
-- user_roles: doar adminii pot acorda/revoca roluri
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- subscriptions: admin vede tot
DROP POLICY IF EXISTS "admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "admins read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- sos_events: admin/mod vede tot
DROP POLICY IF EXISTS "mods read all sos" ON public.sos_events;
CREATE POLICY "mods read all sos" ON public.sos_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

-- business_applications: admin poate șterge cereri
DROP POLICY IF EXISTS "admins delete applications" ON public.business_applications;
CREATE POLICY "admins delete applications" ON public.business_applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ad_campaigns: admin poate moderare totală
DROP POLICY IF EXISTS "admins manage ad campaigns" ON public.ad_campaigns;
CREATE POLICY "admins manage ad campaigns" ON public.ad_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- reports: admin poate șterge
DROP POLICY IF EXISTS "admins delete reports" ON public.reports;
CREATE POLICY "admins delete reports" ON public.reports
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
