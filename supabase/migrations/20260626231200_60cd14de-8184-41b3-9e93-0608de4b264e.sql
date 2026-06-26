
DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected','changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS notification_radius_m integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS notification_radius_m integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill: conținut deja vizibil rămâne vizibil
UPDATE public.events SET moderation_status='approved', is_published=true WHERE moderated_at IS NULL;
UPDATE public.venues SET moderation_status='approved' WHERE is_published = true AND moderation_status = 'pending';
UPDATE public.offers SET moderation_status='approved' WHERE is_published = true AND moderation_status = 'pending';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_suspension_reason text;

-- Gate ownerul nu publică singur
CREATE OR REPLACE FUNCTION public.enforce_owner_no_self_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_is_staff boolean := public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]);
BEGIN
  IF v_is_staff OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.is_published = true AND (TG_OP='INSERT' OR OLD.is_published = false) THEN
    RAISE EXCEPTION 'only_staff_can_publish';
  END IF;
  IF NEW.moderation_status IN ('approved','rejected') AND (TG_OP='INSERT' OR OLD.moderation_status IS DISTINCT FROM NEW.moderation_status) THEN
    RAISE EXCEPTION 'only_staff_can_moderate';
  END IF;
  IF TG_OP='UPDATE' AND OLD.moderation_status='approved' AND (NEW.* IS DISTINCT FROM OLD.*) THEN
    NEW.moderation_status := 'pending';
    NEW.is_published := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS venues_no_self_publish ON public.venues;
CREATE TRIGGER venues_no_self_publish BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_no_self_publish();
DROP TRIGGER IF EXISTS offers_no_self_publish ON public.offers;
CREATE TRIGGER offers_no_self_publish BEFORE INSERT OR UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_no_self_publish();
DROP TRIGGER IF EXISTS events_no_self_publish ON public.events;
CREATE TRIGGER events_no_self_publish BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_no_self_publish();

-- Rapoarte useri
CREATE TABLE IF NOT EXISTS public.nearby_user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('venue','event','offer')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nearby_user_reports TO authenticated;
GRANT ALL ON public.nearby_user_reports TO service_role;
ALTER TABLE public.nearby_user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_insert_own_report" ON public.nearby_user_reports;
CREATE POLICY "user_insert_own_report" ON public.nearby_user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "staff_read_reports" ON public.nearby_user_reports;
CREATE POLICY "staff_read_reports" ON public.nearby_user_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff_update_reports" ON public.nearby_user_reports;
CREATE POLICY "staff_update_reports" ON public.nearby_user_reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- Jurnal notificări partener
CREATE TABLE IF NOT EXISTS public.partner_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  target_id uuid,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_notif_log_partner_day_idx ON public.partner_notification_log (partner_id, created_at DESC);
GRANT SELECT ON public.partner_notification_log TO authenticated;
GRANT ALL ON public.partner_notification_log TO service_role;
ALTER TABLE public.partner_notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_read_own_notif_log" ON public.partner_notification_log;
CREATE POLICY "partner_read_own_notif_log" ON public.partner_notification_log FOR SELECT TO authenticated USING (partner_id = auth.uid() OR public.is_staff(auth.uid()));

-- Setări limite
DO $$ BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    INSERT INTO public.app_settings (key, value) VALUES
      ('partner_max_venues', '5'::jsonb),
      ('partner_max_active_offers', '10'::jsonb),
      ('partner_max_notifications_per_day', '1'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- Vedere coadă moderare
CREATE OR REPLACE VIEW public.admin_moderation_queue AS
  SELECT 'venue'::text AS kind, v.id, v.owner_id, v.name AS title, v.description,
         v.cover_url, v.city, v.moderation_status, v.is_published,
         v.created_at, v.updated_at, v.rejection_reason
    FROM public.venues v
  UNION ALL
  SELECT 'event'::text, e.id, e.host_id, e.title, e.description,
         e.cover_url, e.city, e.moderation_status, e.is_published,
         e.created_at, e.updated_at, e.rejection_reason
    FROM public.events e
  UNION ALL
  SELECT 'offer'::text, o.id, v.owner_id, o.title, o.description,
         v.cover_url, v.city, o.moderation_status, o.is_published,
         o.created_at, o.updated_at, o.rejection_reason
    FROM public.offers o JOIN public.venues v ON v.id = o.venue_id;
GRANT SELECT ON public.admin_moderation_queue TO authenticated, service_role;

-- RPC moderare
CREATE OR REPLACE FUNCTION public.admin_moderate_item(
  p_kind text, p_id uuid, p_decision text, p_reason text DEFAULT NULL,
  p_notification_radius_m integer DEFAULT NULL, p_is_official boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid(); v_pub boolean; v_status public.moderation_status;
BEGIN
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_decision NOT IN ('approved','rejected','changes_requested') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  v_status := p_decision::public.moderation_status; v_pub := (p_decision = 'approved');

  IF p_kind = 'venue' THEN
    UPDATE public.venues SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now(),
      notification_radius_m=COALESCE(p_notification_radius_m, notification_radius_m),
      is_official=COALESCE(p_is_official, is_official)
    WHERE id=p_id;
  ELSIF p_kind = 'event' THEN
    UPDATE public.events SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now(),
      notification_radius_m=COALESCE(p_notification_radius_m, notification_radius_m),
      is_official=COALESCE(p_is_official, is_official)
    WHERE id=p_id;
  ELSIF p_kind = 'offer' THEN
    UPDATE public.offers SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now()
    WHERE id=p_id;
  ELSE RAISE EXCEPTION 'invalid_kind'; END IF;

  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_kind, target_id, after, severity)
    VALUES (v_actor, 'moderate_'||p_kind||'_'||p_decision, p_kind, p_id,
      jsonb_build_object('reason', p_reason, 'radius', p_notification_radius_m, 'official', p_is_official),
      CASE WHEN p_decision='approved' THEN 'info' ELSE 'warning' END);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_moderate_item(text,uuid,text,text,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_item(text,uuid,text,text,integer,boolean) TO authenticated;

-- Suspendare / reactivare partener
CREATE OR REPLACE FUNCTION public.admin_suspend_partner(p_user_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET partner_suspended_at=now(), partner_suspension_reason=p_reason WHERE id=p_user_id;
  UPDATE public.venues SET is_published=false WHERE owner_id=p_user_id;
  UPDATE public.offers SET is_published=false WHERE venue_id IN (SELECT id FROM public.venues WHERE owner_id=p_user_id);
  UPDATE public.events SET is_published=false WHERE host_id=p_user_id;
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_kind, target_id, after, severity)
    VALUES (v_actor, 'partner_suspend', 'user', p_user_id, jsonb_build_object('reason', p_reason), 'warning');
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_suspend_partner(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_partner(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reinstate_partner(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET partner_suspended_at=NULL, partner_suspension_reason=NULL WHERE id=p_user_id;
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_kind, target_id, severity)
    VALUES (v_actor, 'partner_reinstate', 'user', p_user_id, 'info');
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_reinstate_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reinstate_partner(uuid) TO authenticated;

-- Limită notificări partener
CREATE OR REPLACE FUNCTION public.partner_can_send_notification(p_partner_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_limit int := 1; v_count int; v_suspended timestamptz;
BEGIN
  SELECT partner_suspended_at INTO v_suspended FROM public.profiles WHERE id=p_partner_id;
  IF v_suspended IS NOT NULL THEN RETURN false; END IF;
  BEGIN
    SELECT COALESCE((value)::text::int, 1) INTO v_limit FROM public.app_settings WHERE key='partner_max_notifications_per_day';
  EXCEPTION WHEN others THEN v_limit := 1; END;
  SELECT count(*) INTO v_count FROM public.partner_notification_log
    WHERE partner_id=p_partner_id AND created_at > now() - interval '1 day';
  RETURN v_count < v_limit;
END $$;
GRANT EXECUTE ON FUNCTION public.partner_can_send_notification(uuid) TO authenticated, service_role;

-- nearby_points cu filtru suspendare + moderare
CREATE OR REPLACE FUNCTION public.nearby_points(p_bucket_id text, p_kinds text[] DEFAULT ARRAY['venue','event','offer'])
RETURNS TABLE(kind text, id uuid, venue_id uuid, name text, category text, description text,
              cover_url text, lat double precision, lng double precision,
              starts_at timestamptz, ends_at timestamptz, city text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE buckets text[];
BEGIN
  IF p_bucket_id IS NULL THEN RETURN; END IF;
  buckets := public.neighbour_buckets(p_bucket_id);

  IF 'venue' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'venue'::text, v.id, NULL::uuid, v.name, v.category, v.description,
             v.cover_url, v.lat, v.lng, NULL::timestamptz, NULL::timestamptz, v.city
      FROM public.venues v LEFT JOIN public.profiles p ON p.id=v.owner_id
      WHERE v.is_published=true AND v.moderation_status='approved'
        AND v.geo_bucket_id = ANY(buckets) AND p.partner_suspended_at IS NULL
      LIMIT 200;
  END IF;

  IF 'event' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'event'::text, e.id, NULL::uuid, e.title, e.event_type::text, e.description,
             e.cover_url, e.lat, e.lng, e.starts_at, e.ends_at, e.city
      FROM public.events e LEFT JOIN public.profiles p ON p.id=e.host_id
      WHERE e.is_private=false AND e.is_published=true AND e.moderation_status='approved'
        AND e.geo_bucket_id = ANY(buckets)
        AND (e.ends_at IS NULL OR e.ends_at > now())
        AND p.partner_suspended_at IS NULL
      LIMIT 200;
  END IF;

  IF 'offer' = ANY(p_kinds) THEN
    RETURN QUERY
      SELECT 'offer'::text, o.id, v.id, o.title, v.category, o.description,
             v.cover_url, v.lat, v.lng, o.valid_from, o.valid_to, v.city
      FROM public.offers o JOIN public.venues v ON v.id=o.venue_id
      LEFT JOIN public.profiles p ON p.id=v.owner_id
      WHERE o.is_published=true AND o.moderation_status='approved'
        AND v.is_published=true AND v.moderation_status='approved'
        AND v.geo_bucket_id = ANY(buckets)
        AND (o.valid_to IS NULL OR o.valid_to > now())
        AND p.partner_suspended_at IS NULL
      LIMIT 200;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.nearby_points(text, text[]) TO anon, authenticated, service_role;
