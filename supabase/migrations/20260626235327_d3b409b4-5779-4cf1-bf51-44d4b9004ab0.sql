
-- 1) Add background_location to consent registry
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE (
  kind text, current_version text, required boolean, art9 boolean, description text
) LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('terms',                '2026-06-22', true,  false, 'Termeni și condiții.'),
    ('privacy',              '2026-06-22', true,  false, 'Politică de confidențialitate.'),
    ('health_data',          '2026-06-22', false, true,  'Date de sănătate (Art. 9): HIV status, dată test.'),
    ('age_verification',     '2026-06-26', false, true,  'Imagine biometrică (selfie) trimisă către Didit pentru estimarea vârstei. Art. 9.'),
    ('ai_features',          '2026-06-26', false, false, 'Text de profil / chat procesat de modele AI externe (Lovable AI Gateway).'),
    ('push_notifications',   '2026-06-26', false, false, 'Abonament push web pentru notificări (mesaje, match-uri, evenimente).'),
    ('background_location',  '2026-06-26', false, false, 'Acces locație în fundal pentru geofencing (notificări când treci pe lângă un eveniment/local cu app-ul închis).'),
    ('marketing',            '2026-06-22', false, false, 'Comunicări de marketing (newsletter, oferte).')
  ) AS t(kind, current_version, required, art9, description)
$$;
GRANT EXECUTE ON FUNCTION public.consent_kinds() TO anon, authenticated, service_role;

-- 2) Profile toggle for proximity notifications (granular control)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS proximity_notifications_enabled boolean NOT NULL DEFAULT true;

-- 3) Proximity notification log (anti-spam ledger; no trajectory stored)
CREATE TABLE IF NOT EXISTS public.proximity_notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  point_kind  text NOT NULL CHECK (point_kind IN ('venue','event')),
  point_id    uuid NOT NULL,
  layer       text NOT NULL CHECK (layer IN ('foreground','background')),
  sent_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proximity_notif_user_point_idx
  ON public.proximity_notification_log (user_id, point_kind, point_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS proximity_notif_user_day_idx
  ON public.proximity_notification_log (user_id, sent_at DESC);

GRANT SELECT ON public.proximity_notification_log TO authenticated;
GRANT ALL ON public.proximity_notification_log TO service_role;

ALTER TABLE public.proximity_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see their own proximity log"
  ON public.proximity_notification_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "staff see all proximity log"
  ON public.proximity_notification_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 4) Anti-spam settings in app_settings (sursa autoritativă)
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'proximity_notifications',
  jsonb_build_object(
    'cooldown_hours', 24,
    'daily_cap_per_user', 8,
    'quiet_start_hour', 22,
    'quiet_end_hour', 8,
    'default_radius_m', 2000,
    'max_radius_m', 5000
  ),
  'notifications',
  'Anti-spam și quiet hours pentru notificările de proximitate (Strat 1 + Strat 2).'
)
ON CONFLICT (key) DO NOTHING;

-- 5) Gate function: server-side enforcement of all anti-spam rules.
CREATE OR REPLACE FUNCTION public.try_record_proximity_hit(
  p_kind  text,
  p_id    uuid,
  p_layer text DEFAULT 'foreground'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Per-user toggle
  SELECT proximity_notifications_enabled INTO v_enabled
    FROM public.profiles WHERE id = v_uid;
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_disabled');
  END IF;

  -- Background layer requires explicit consent
  IF p_layer = 'background'
     AND NOT public.has_active_consent(v_uid, 'background_location') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'background_consent_missing');
  END IF;

  -- Resolve point: must be approved+published, owner not suspended
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

  -- Load anti-spam settings
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'proximity_notifications';
  v_cooldown_h  := COALESCE((v_settings->>'cooldown_hours')::int, 24);
  v_daily_cap   := COALESCE((v_settings->>'daily_cap_per_user')::int, 8);
  v_quiet_start := COALESCE((v_settings->>'quiet_start_hour')::int, 22);
  v_quiet_end   := COALESCE((v_settings->>'quiet_end_hour')::int, 8);

  -- Quiet hours (Europe/Bucharest)
  v_user_tz := COALESCE((SELECT timezone FROM public.profiles WHERE id = v_uid), 'Europe/Bucharest');
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

  -- Per-point cooldown
  SELECT MAX(sent_at) INTO v_last_at
    FROM public.proximity_notification_log
   WHERE user_id = v_uid AND point_kind = p_kind AND point_id = p_id;
  IF v_last_at IS NOT NULL AND v_last_at > now() - make_interval(hours => v_cooldown_h) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown');
  END IF;

  -- Daily cap
  SELECT COUNT(*) INTO v_count_today
    FROM public.proximity_notification_log
   WHERE user_id = v_uid AND sent_at > now() - interval '24 hours';
  IF v_count_today >= v_daily_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_cap');
  END IF;

  -- Allowed → log
  INSERT INTO public.proximity_notification_log (user_id, point_kind, point_id, layer)
  VALUES (v_uid, p_kind, p_id, p_layer);

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.try_record_proximity_hit(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_record_proximity_hit(text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.try_record_proximity_hit(text, uuid, text) IS
'Gate server-side pentru notificările de proximitate. Verifică toggle user, ore liniștite, cooldown per punct, plafon zilnic, status moderare/publicare/suspendare partener. Loghează doar dacă e permis. NU primește coordonatele userului.';
