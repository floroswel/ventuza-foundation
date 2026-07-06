
-- GDPR Art.5(2) accountability: moderator_* RPCs must leave an audit trail.
-- Idempotent: replaces function bodies, appends INSERT into admin_audit_log.

CREATE OR REPLACE FUNCTION public.moderator_ban_user(_target uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
     SET banned_at = now(), banned_reason = _reason,
         suspended_until = now() + interval '100 years',
         suspended_reason = _reason
   WHERE id = _target;
  UPDATE public.risk_flags SET status='resolved', resolved_at=now(), resolved_by=auth.uid()
   WHERE user_id = _target AND status='open';
  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, justification, severity)
  VALUES (auth.uid(), 'moderator.ban', 'profiles', _target::text, _reason, 'critical');
END $function$;

CREATE OR REPLACE FUNCTION public.moderator_suspend_user(_target uuid, _hours integer, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
    SET suspended_until = CASE WHEN _hours > 0 THEN now() + (_hours || ' hours')::interval ELSE NULL END,
        suspended_reason = _reason
    WHERE id = _target;
  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, justification, severity, after_data)
  VALUES (auth.uid(), 'moderator.suspend', 'profiles', _target::text, _reason, 'warning',
          jsonb_build_object('hours', _hours));
END;
$function$;

CREATE OR REPLACE FUNCTION public.moderator_warn_user(_target uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET warned_at = now(), warned_reason = _reason WHERE id = _target;
  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, justification, severity)
  VALUES (auth.uid(), 'moderator.warn', 'profiles', _target::text, _reason, 'info');
END $function$;

CREATE OR REPLACE FUNCTION public.moderator_verify_user(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET verified = true, verified_at = now(),
    verification_status = 'verified', verification_reason = 'manual moderator approval'
   WHERE id = _target;
  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, severity)
  VALUES (auth.uid(), 'moderator.verify', 'profiles', _target::text, 'info');
END $function$;
