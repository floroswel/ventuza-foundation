
-- 1) Tabel notificări status partener
CREATE TABLE IF NOT EXISTS public.partner_status_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('venue','event','offer')),
  item_id uuid NOT NULL,
  item_title text,
  decision text NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS partner_status_notif_partner_idx
  ON public.partner_status_notifications (partner_id, created_at DESC);

GRANT SELECT, UPDATE ON public.partner_status_notifications TO authenticated;
GRANT ALL ON public.partner_status_notifications TO service_role;

ALTER TABLE public.partner_status_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_read_own_status_notif" ON public.partner_status_notifications;
CREATE POLICY "partner_read_own_status_notif" ON public.partner_status_notifications
  FOR SELECT TO authenticated
  USING (partner_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "partner_mark_own_status_notif_read" ON public.partner_status_notifications;
CREATE POLICY "partner_mark_own_status_notif_read" ON public.partner_status_notifications
  FOR UPDATE TO authenticated
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- 2) Extind admin_moderate_item să scrie și în partner_status_notifications
CREATE OR REPLACE FUNCTION public.admin_moderate_item(
  p_kind text, p_id uuid, p_decision text, p_reason text DEFAULT NULL,
  p_notification_radius_m integer DEFAULT NULL, p_is_official boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_pub boolean;
  v_status public.moderation_status;
  v_owner uuid;
  v_title text;
BEGIN
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_decision NOT IN ('approved','rejected','changes_requested') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  v_status := p_decision::public.moderation_status;
  v_pub := (p_decision = 'approved');

  IF p_kind = 'venue' THEN
    UPDATE public.venues SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now(),
      notification_radius_m=COALESCE(p_notification_radius_m, notification_radius_m),
      is_official=COALESCE(p_is_official, is_official)
      WHERE id=p_id
      RETURNING owner_id, name INTO v_owner, v_title;
  ELSIF p_kind = 'event' THEN
    UPDATE public.events SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now(),
      notification_radius_m=COALESCE(p_notification_radius_m, notification_radius_m),
      is_official=COALESCE(p_is_official, is_official)
      WHERE id=p_id
      RETURNING host_id, title INTO v_owner, v_title;
  ELSIF p_kind = 'offer' THEN
    UPDATE public.offers SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now() WHERE id=p_id
      RETURNING title INTO v_title;
    SELECT v.owner_id INTO v_owner
      FROM public.offers o JOIN public.venues v ON v.id=o.venue_id WHERE o.id=p_id;
  ELSE
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, after_data, severity)
    VALUES (v_actor, 'moderate_'||p_kind||'_'||p_decision, p_kind, p_id::text,
      jsonb_build_object('reason', p_reason, 'radius', p_notification_radius_m, 'official', p_is_official),
      CASE WHEN p_decision='approved' THEN 'info' ELSE 'warning' END);
  EXCEPTION WHEN others THEN NULL; END;

  -- Notificare status partener (best-effort, niciodată blochează moderarea)
  IF v_owner IS NOT NULL THEN
    BEGIN
      INSERT INTO public.partner_status_notifications (partner_id, kind, item_id, item_title, decision, reason)
      VALUES (v_owner, p_kind, p_id, v_title, p_decision, p_reason);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;
