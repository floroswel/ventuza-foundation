
-- Rewrite functions using correct audit column names (after_data / before_data)

CREATE OR REPLACE FUNCTION public.admin_apply_strike(
  _target uuid, _reason text, _reason_code text DEFAULT NULL, _severity int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_active_count int;
  v_new_severity int;
  v_action text;
  v_ban_until timestamptz;
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(_reason) < 5 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT COUNT(*) INTO v_active_count FROM public.user_strikes
   WHERE user_id=_target AND revoked_at IS NULL AND decay_at>now();

  v_new_severity := COALESCE(_severity, LEAST(v_active_count+1, 5));

  INSERT INTO public.user_strikes(user_id,severity,reason,reason_code,issued_by)
  VALUES (_target,v_new_severity,_reason,_reason_code,v_actor);

  CASE v_new_severity
    WHEN 1 THEN v_action := 'warning';
    WHEN 2 THEN v_action := 'mute_24h'; v_ban_until := now()+interval '24 hours';
                UPDATE public.profiles SET banned_until=v_ban_until WHERE id=_target;
    WHEN 3 THEN v_action := 'shadowban_7d';
                UPDATE public.profiles SET shadowbanned_at=now() WHERE id=_target;
    WHEN 4 THEN v_action := 'ban_30d'; v_ban_until := now()+interval '30 days';
                UPDATE public.profiles SET banned_until=v_ban_until WHERE id=_target;
    WHEN 5 THEN v_action := 'ban_permanent';
                UPDATE public.profiles SET banned_at=now(), banned_reason=_reason WHERE id=_target;
  END CASE;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, after_data, severity)
  VALUES (v_actor,'admin_apply_strike','profiles',_target,
          jsonb_build_object('severity',v_new_severity,'action',v_action,'reason',_reason),
          CASE WHEN v_new_severity>=4 THEN 'critical' ELSE 'warning' END);

  RETURN jsonb_build_object('severity',v_new_severity,'action',v_action,'banned_until',v_ban_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_temporary_ban(_target uuid, _until timestamptz, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(_reason)<10 THEN RAISE EXCEPTION 'reason_required_10_chars'; END IF;
  IF _until IS NOT NULL AND _until<=now() THEN RAISE EXCEPTION 'until_must_be_future'; END IF;
  UPDATE public.profiles SET banned_until=_until WHERE id=_target;
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor, CASE WHEN _until IS NULL THEN 'admin_lift_temporary_ban' ELSE 'admin_set_temporary_ban' END,
    'profiles',_target,jsonb_build_object('banned_until',_until,'reason',_reason),'warning');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_legal_hold(_target uuid, _enable boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor,'super_admin') THEN RAISE EXCEPTION 'forbidden_super_admin_only' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(_reason)<10 THEN RAISE EXCEPTION 'reason_required_10_chars'; END IF;
  UPDATE public.profiles
     SET legal_hold=_enable,
         legal_hold_reason=CASE WHEN _enable THEN _reason ELSE NULL END,
         legal_hold_at=CASE WHEN _enable THEN now() ELSE NULL END,
         legal_hold_by=CASE WHEN _enable THEN v_actor ELSE NULL END
   WHERE id=_target;
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor, CASE WHEN _enable THEN 'admin_set_legal_hold' ELSE 'admin_clear_legal_hold' END,
    'profiles',_target,jsonb_build_object('legal_hold',_enable,'reason',_reason),'critical');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_assign_moderator(_kind text, _item_id uuid, _moderator uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _kind NOT IN ('report','verification') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF _kind='report' THEN
    UPDATE public.reports SET assigned_moderator_id=_moderator,
      assigned_at=CASE WHEN _moderator IS NULL THEN NULL ELSE now() END WHERE id=_item_id;
  ELSE
    UPDATE public.verification_requests SET assigned_moderator_id=_moderator,
      assigned_at=CASE WHEN _moderator IS NULL THEN NULL ELSE now() END WHERE id=_item_id;
  END IF;
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor,'admin_assign_moderator',_kind,_item_id,jsonb_build_object('moderator',_moderator),'info');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_grant_badge(_target uuid, _code text, _expires_at timestamptz, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid(); v_manual boolean;
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(_reason)<10 THEN RAISE EXCEPTION 'reason_required_10_chars'; END IF;
  SELECT is_manual INTO v_manual FROM public.badge_registry WHERE code=_code AND is_active=true;
  IF v_manual IS NULL THEN RAISE EXCEPTION 'badge_not_found'; END IF;
  IF NOT v_manual THEN RAISE EXCEPTION 'badge_not_manual'; END IF;
  INSERT INTO public.user_badge_grants(user_id,badge_code,granted_by,expires_at,reason)
  VALUES (_target,_code,v_actor,_expires_at,_reason)
  ON CONFLICT (user_id,badge_code) DO UPDATE
    SET granted_by=v_actor, granted_at=now(), expires_at=_expires_at, reason=_reason,
        revoked_at=NULL, revoked_by=NULL, revoke_reason=NULL;
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor,'admin_grant_badge','user_badge_grants',_target,
          jsonb_build_object('code',_code,'expires_at',_expires_at,'reason',_reason),'critical');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(_target uuid, _code text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_or_above(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(_reason)<10 THEN RAISE EXCEPTION 'reason_required_10_chars'; END IF;
  UPDATE public.user_badge_grants SET revoked_at=now(), revoked_by=v_actor, revoke_reason=_reason
   WHERE user_id=_target AND badge_code=_code AND revoked_at IS NULL;
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor,'admin_revoke_badge','user_badge_grants',_target,
          jsonb_build_object('code',_code,'reason',_reason),'critical');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_send_official_message(_target uuid, _body text, _subject text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_convo uuid;
  v_msg_id uuid;
  v_full_body text;
BEGIN
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _body IS NULL OR length(_body)<3 THEN RAISE EXCEPTION 'body_required'; END IF;
  v_full_body := COALESCE('['||_subject||']'||E'\n\n','') || _body;
  SELECT id INTO v_convo FROM public.conversations
   WHERE (user_a=v_actor AND user_b=_target) OR (user_a=_target AND user_b=v_actor) LIMIT 1;
  IF v_convo IS NULL THEN
    INSERT INTO public.conversations(user_a,user_b) VALUES (v_actor,_target) RETURNING id INTO v_convo;
  END IF;
  INSERT INTO public.messages(conversation_id,sender_id,receiver_id,body,is_official)
  VALUES (v_convo,v_actor,_target,v_full_body,true) RETURNING id INTO v_msg_id;
  INSERT INTO public.notifications(user_id,type,title,body,data)
  VALUES (_target,'admin_message',COALESCE(_subject,'Mesaj oficial Ventuza'),left(_body,200),
          jsonb_build_object('conversation_id',v_convo,'message_id',v_msg_id));
  INSERT INTO public.admin_audit_log(actor_id,action,target_table,target_id,after_data,severity)
  VALUES (v_actor,'admin_send_official_message','messages',v_msg_id,
          jsonb_build_object('target',_target,'subject',_subject,'chars',length(_body)),'warning');
  RETURN v_msg_id;
END; $$;
