CREATE OR REPLACE FUNCTION public.try_record_proximity_hit(p_kind text, p_id uuid, p_layer text DEFAULT 'foreground'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_settings jsonb;
  v_cooldown_h int;
  v_daily_cap int;
  v_quiet_start int;
  v_quiet_end int;
  v_user_hour int;
  v_user_tz text;
  v_count_today int;
  v_last_at timestamptz;
  v_enabled boolean;
  v_owner uuid;
  v_published boolean := false;
  v_approved boolean := false;
  v_suspended_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;
  IF p_kind NOT IN ('venue','event') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'bad_kind');
  END IF;
  IF p_layer NOT IN ('foreground','background') THEN
    p_layer := 'foreground';
  END IF;

  SELECT proximity_notifications_enabled INTO v_enabled
    FROM public.profiles WHERE id = v_uid;
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_disabled');
  END IF;

  IF p_layer = 'background'
     AND NOT public.has_active_consent(v_uid, 'background_location') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'background_consent_missing');
  END IF;

  IF p_kind = 'venue' THEN
    SELECT v.is_published, (v.moderation_status = 'approved'), v.owner_id, p.partner_suspended_at
      INTO v_published, v_approved, v_owner, v_suspended_at
      FROM public.venues v
      LEFT JOIN public.profiles p ON p.id = v.owner_id
     WHERE v.id = p_id;
  ELSE
    SELECT e.is_published, (e.moderation_status = 'approved'), e.host_id, p.partner_suspended_at
      INTO v_published, v_approved, v_owner, v_suspended_at
      FROM public.events e
      LEFT JOIN public.profiles p ON p.id = e.host_id
     WHERE e.id = p_id;
  END IF;

  IF NOT COALESCE(v_published, false) OR NOT COALESCE(v_approved, false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_published');
  END IF;
  IF v_suspended_at IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'partner_suspended');
  END IF;

  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'proximity_notifications';
  v_cooldown_h  := COALESCE((v_settings->>'cooldown_hours')::int, 24);
  v_daily_cap   := COALESCE((v_settings->>'daily_cap_per_user')::int, 8);
  v_quiet_start := COALESCE((v_settings->>'quiet_start_hour')::int, 22);
  v_quiet_end   := COALESCE((v_settings->>'quiet_end_hour')::int, 8);

  -- Quiet hours: fus orar din setări, fallback Europe/Bucharest.
  -- (nu mai citim o coloană `timezone` pe profiles — nu există)
  v_user_tz := COALESCE(NULLIF(v_settings->>'timezone', ''), 'Europe/Bucharest');
  v_user_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE v_user_tz))::int;
  IF v_quiet_start > v_quiet_end THEN
    IF v_user_hour >= v_quiet_start OR v_user_hour < v_quiet_end THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  ELSE
    IF v_user_hour >= v_quiet_start AND v_user_hour < v_quiet_end THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  END IF;

  SELECT MAX(sent_at) INTO v_last_at
    FROM public.proximity_notification_log
   WHERE user_id = v_uid AND point_kind = p_kind AND point_id = p_id;
  IF v_last_at IS NOT NULL AND v_last_at > now() - make_interval(hours => v_cooldown_h) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown');
  END IF;

  SELECT COUNT(*) INTO v_count_today
    FROM public.proximity_notification_log
   WHERE user_id = v_uid AND sent_at > now() - interval '24 hours';
  IF v_count_today >= v_daily_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_cap');
  END IF;

  INSERT INTO public.proximity_notification_log (user_id, point_kind, point_id, layer)
  VALUES (v_uid, p_kind, p_id, p_layer);

  RETURN jsonb_build_object('allowed', true);
END;
$function$;