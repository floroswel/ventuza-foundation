-- 1) Politici: super_admin trebuie tratat ca admin
DROP POLICY IF EXISTS "moderators read all reports" ON public.reports;
CREATE POLICY "moderators read all reports" ON public.reports FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "moderators update reports" ON public.reports;
CREATE POLICY "moderators update reports" ON public.reports FOR UPDATE TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "admins delete reports" ON public.reports;
CREATE POLICY "admins delete reports" ON public.reports FOR DELETE TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "mods read all photo hashes" ON public.photo_hashes;
CREATE POLICY "mods read all photo hashes" ON public.photo_hashes FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "mods read risk flags" ON public.risk_flags;
CREATE POLICY "mods read risk flags" ON public.risk_flags FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "mods update risk flags" ON public.risk_flags;
CREATE POLICY "mods update risk flags" ON public.risk_flags FOR UPDATE TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "mods read all sos" ON public.sos_events;
CREATE POLICY "mods read all sos" ON public.sos_events FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admins can view all applications" ON public.business_applications;
CREATE POLICY "Admins can view all applications" ON public.business_applications FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update applications" ON public.business_applications;
CREATE POLICY "Admins can update applications" ON public.business_applications FOR UPDATE TO authenticated
USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins delete applications" ON public.business_applications;
CREATE POLICY "admins delete applications" ON public.business_applications FOR DELETE TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins manage banned fps" ON public.banned_fingerprints;
CREATE POLICY "admins manage banned fps" ON public.banned_fingerprints FOR ALL TO authenticated
USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "admins read all subscriptions" ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins manage ad campaigns" ON public.ad_campaigns;
CREATE POLICY "admins manage ad campaigns" ON public.ad_campaigns FOR ALL TO authenticated
USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "exp_admin_write" ON public.experiments;
CREATE POLICY "exp_admin_write" ON public.experiments FOR ALL TO authenticated
USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "ea_owner_read" ON public.experiment_assignments;
CREATE POLICY "ea_owner_read" ON public.experiment_assignments FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "ee_admin_read" ON public.experiment_events;
CREATE POLICY "ee_admin_read" ON public.experiment_events FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "rr_party_read" ON public.referral_redemptions;
CREATE POLICY "rr_party_read" ON public.referral_redemptions FOR SELECT TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "fb_admin_read" ON public.feedback;
CREATE POLICY "fb_admin_read" ON public.feedback FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "fb_admin_update" ON public.feedback;
CREATE POLICY "fb_admin_update" ON public.feedback FOR UPDATE TO authenticated
USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "wv_admin_read" ON public.web_vitals;
CREATE POLICY "wv_admin_read" ON public.web_vitals FOR SELECT TO authenticated
USING (public.is_admin_or_above(auth.uid()));

-- 2) Funcții SECURITY DEFINER care ignorau super_admin: rescriere in-place a gardei
DO $do$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('admin_risk_queue','moderator_ban_user','moderator_suspend_user','moderator_verify_user','moderator_warn_user')
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := replace(def, 'public.has_role(auth.uid(),''admin'')', '(public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''super_admin''))');
    newdef := replace(newdef, 'public.has_role(auth.uid(), ''admin'')', '(public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''super_admin''))');
    IF newdef <> def THEN EXECUTE newdef; END IF;
  END LOOP;
END
$do$;

-- 3) Număr unic de cont pentru fiecare profil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_no bigint;
CREATE SEQUENCE IF NOT EXISTS public.profiles_account_no_seq OWNED BY public.profiles.account_no;
UPDATE public.profiles SET account_no = nextval('public.profiles_account_no_seq') WHERE account_no IS NULL;
ALTER TABLE public.profiles ALTER COLUMN account_no SET DEFAULT nextval('public.profiles_account_no_seq');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_account_no_key ON public.profiles(account_no);

-- 4) Notificare la adăugarea la favorite
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'favorite';