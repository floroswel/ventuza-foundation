
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
      is_official=COALESCE(p_is_official, is_official) WHERE id=p_id;
  ELSIF p_kind = 'event' THEN
    UPDATE public.events SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now(),
      notification_radius_m=COALESCE(p_notification_radius_m, notification_radius_m),
      is_official=COALESCE(p_is_official, is_official) WHERE id=p_id;
  ELSIF p_kind = 'offer' THEN
    UPDATE public.offers SET moderation_status=v_status, is_published=v_pub,
      rejection_reason=CASE WHEN p_decision='approved' THEN NULL ELSE p_reason END,
      moderated_by=v_actor, moderated_at=now() WHERE id=p_id;
  ELSE RAISE EXCEPTION 'invalid_kind'; END IF;

  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, after_data, severity)
    VALUES (v_actor, 'moderate_'||p_kind||'_'||p_decision, p_kind, p_id::text,
      jsonb_build_object('reason', p_reason, 'radius', p_notification_radius_m, 'official', p_is_official),
      CASE WHEN p_decision='approved' THEN 'info' ELSE 'warning' END);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;

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
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, after_data, severity)
    VALUES (v_actor, 'partner_suspend', 'user', p_user_id::text, jsonb_build_object('reason', p_reason), 'warning');
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reinstate_partner(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET partner_suspended_at=NULL, partner_suspension_reason=NULL WHERE id=p_user_id;
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, severity)
    VALUES (v_actor, 'partner_reinstate', 'user', p_user_id::text, 'info');
  EXCEPTION WHEN others THEN NULL; END;
  RETURN jsonb_build_object('ok', true);
END $$;
