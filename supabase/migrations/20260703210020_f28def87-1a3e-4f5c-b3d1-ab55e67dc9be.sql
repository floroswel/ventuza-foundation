
-- ============================================================================
-- FEATURE: Anunțuri de la parteneri Premium către useri
-- ============================================================================

-- 1) Nou tip de notificare
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'partner_broadcast'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'partner_broadcast';
  END IF;
END $$;

-- 2) Consimțământ nou (opt-in, default OFF) — actualizează consent_kinds()
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE(kind text, current_version int, required boolean, art9 boolean, description text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('terms', 1, true, false, 'Termeni și condiții'),
    ('privacy', 1, true, false, 'Politica de confidențialitate'),
    ('age_verification', 2, true, true, 'Procesare imagini pentru verificare vârstă (proces intern, fără terți)'),
    ('internal_verification', 1, true, true, 'Verificare identitate internă prin selfie-uri liveness — review manual de moderator'),
    ('health_data', 1, false, true, 'Date de sănătate (HIV status)'),
    ('ai_features', 1, false, false, 'Funcții AI (recomandări, moderare, traducere)'),
    ('push_notifications', 1, false, false, 'Notificări push'),
    ('background_location', 1, false, false, 'Locație în background pentru geofencing'),
    ('marketing', 1, false, false, 'Comunicări marketing'),
    ('partner_announcements', 1, false, false, 'Anunțuri de la parteneri Premium (evenimente, oferte). Opt-in explicit — implicit OPRIT. Poți retrage oricând din Setări.')
  ) AS t(kind, current_version, required, art9, description);
$$;

-- 3) Coloană sincron pe profil (rapid pentru filtrare la trimitere)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_announcements_enabled boolean NOT NULL DEFAULT false;

-- Trigger: la înregistrarea/retragerea consimțământului partner_announcements,
-- sincronizează coloana din profiles.
CREATE OR REPLACE FUNCTION public.sync_partner_announcements_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'partner_announcements' THEN
    UPDATE public.profiles
       SET partner_announcements_enabled = COALESCE(NEW.accepted, false)
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_partner_announcements_consent ON public.consent_log;
CREATE TRIGGER trg_sync_partner_announcements_consent
AFTER INSERT ON public.consent_log
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_announcements_consent();

-- 4) Setări admin — cote per plan (modificabile din admin)
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'partner_broadcast_quotas',
  jsonb_build_object(
    'per_plan', jsonb_build_object(
      'Free',    jsonb_build_object('weekly_cap', 0),
      'Starter', jsonb_build_object('weekly_cap', 1),
      'Premium', jsonb_build_object('weekly_cap', 999999),
      'Elite',   jsonb_build_object('weekly_cap', 999999)
    ),
    'max_radius_m',            10000,
    'max_recipients_per_send', 5000,
    'min_body_len',            10,
    'max_body_len',            280,
    'min_title_len',           4,
    'max_title_len',           80,
    'user_cooldown_hours',     24
  ),
  'Cote pentru anunțuri parteneri (broadcast).'
)
ON CONFLICT (key) DO NOTHING;

-- 5) Tabel: istoric broadcast-uri
CREATE TABLE IF NOT EXISTS public.partner_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('online','nearby','followers','city')),
  radius_m integer,
  city text,
  deep_link text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  recipients_targeted integer NOT NULL DEFAULT 0,
  recipients_delivered integer NOT NULL DEFAULT 0,
  plan_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS partner_broadcasts_partner_idx
  ON public.partner_broadcasts(partner_id, created_at DESC);

GRANT SELECT ON public.partner_broadcasts TO authenticated;
GRANT ALL    ON public.partner_broadcasts TO service_role;
ALTER TABLE public.partner_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_read_own_broadcasts" ON public.partner_broadcasts;
CREATE POLICY "partner_read_own_broadcasts"
ON public.partner_broadcasts FOR SELECT
TO authenticated
USING (partner_id = auth.uid() OR public.is_staff(auth.uid()));

-- 6) RPC: status cotă (pentru UI partener)
CREATE OR REPLACE FUNCTION public.partner_broadcast_quota_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub RECORD;
  _cfg jsonb;
  _cap int;
  _used int;
  _plan text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;

  SELECT s.plan_code, s.status, s.current_period_end, s.grace_until
    INTO _sub
    FROM public.partner_subscriptions s
   WHERE s.owner_id = _uid
   ORDER BY s.created_at DESC LIMIT 1;

  _plan := COALESCE(_sub.plan_code, 'Free');
  SELECT value INTO _cfg FROM public.app_settings WHERE key='partner_broadcast_quotas';
  _cap := COALESCE((_cfg #> ARRAY['per_plan', _plan, 'weekly_cap'])::text::int, 0);

  SELECT count(*) INTO _used
    FROM public.partner_broadcasts
   WHERE partner_id = _uid
     AND status = 'sent'
     AND created_at > now() - interval '7 days';

  RETURN jsonb_build_object(
    'plan_code',   _plan,
    'active',      _sub.status IN ('active','grace'),
    'weekly_cap',  _cap,
    'used_7d',     _used,
    'remaining',   GREATEST(_cap - _used, 0),
    'max_radius_m',            COALESCE((_cfg->>'max_radius_m')::int, 10000),
    'max_recipients_per_send', COALESCE((_cfg->>'max_recipients_per_send')::int, 5000),
    'min_body_len',            COALESCE((_cfg->>'min_body_len')::int, 10),
    'max_body_len',            COALESCE((_cfg->>'max_body_len')::int, 280),
    'min_title_len',           COALESCE((_cfg->>'min_title_len')::int, 4),
    'max_title_len',           COALESCE((_cfg->>'max_title_len')::int, 80),
    'user_cooldown_hours',     COALESCE((_cfg->>'user_cooldown_hours')::int, 24)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_broadcast_quota_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_broadcast_quota_status() TO authenticated;

-- 7) RPC principal: trimite broadcast
CREATE OR REPLACE FUNCTION public.partner_send_broadcast(
  p_title       text,
  p_body        text,
  p_target_kind text,
  p_venue_id    uuid DEFAULT NULL,
  p_radius_m    integer DEFAULT 10000,
  p_city        text DEFAULT NULL,
  p_deep_link   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub RECORD;
  _plan text;
  _cfg jsonb;
  _cap int;
  _used int;
  _venue RECORD;
  _min_title int; _max_title int; _min_body int; _max_body int;
  _max_radius int; _cap_recipients int; _cooldown_h int;
  _broadcast_id uuid;
  _targeted int := 0;
  _delivered int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;

  IF p_target_kind NOT IN ('online','nearby','followers','city') THEN
    RAISE EXCEPTION 'invalid_target_kind' USING ERRCODE='22023';
  END IF;

  -- config
  SELECT value INTO _cfg FROM public.app_settings WHERE key='partner_broadcast_quotas';
  _min_title      := COALESCE((_cfg->>'min_title_len')::int, 4);
  _max_title      := COALESCE((_cfg->>'max_title_len')::int, 80);
  _min_body       := COALESCE((_cfg->>'min_body_len')::int, 10);
  _max_body       := COALESCE((_cfg->>'max_body_len')::int, 280);
  _max_radius     := COALESCE((_cfg->>'max_radius_m')::int, 10000);
  _cap_recipients := COALESCE((_cfg->>'max_recipients_per_send')::int, 5000);
  _cooldown_h     := COALESCE((_cfg->>'user_cooldown_hours')::int, 24);

  -- validare text
  IF p_title IS NULL OR length(btrim(p_title)) < _min_title OR length(p_title) > _max_title THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE='22023';
  END IF;
  IF p_body IS NULL OR length(btrim(p_body)) < _min_body OR length(p_body) > _max_body THEN
    RAISE EXCEPTION 'invalid_body' USING ERRCODE='22023';
  END IF;

  -- subscription activ + non-Free
  SELECT s.plan_code, s.status, s.current_period_end, s.grace_until
    INTO _sub
    FROM public.partner_subscriptions s
   WHERE s.owner_id = _uid
   ORDER BY s.created_at DESC LIMIT 1;

  _plan := COALESCE(_sub.plan_code, 'Free');
  IF _plan = 'Free' OR _sub.status NOT IN ('active','grace') THEN
    RAISE EXCEPTION 'plan_not_eligible' USING ERRCODE='42501',
      HINT='Necesită abonament activ (non-Free).';
  END IF;

  -- partener nesuspendat
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=_uid AND partner_suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'partner_suspended' USING ERRCODE='42501';
  END IF;

  -- venue check (dacă venue e specificat) — trebuie să fie al lui și aprobat
  IF p_venue_id IS NOT NULL THEN
    SELECT v.id, v.owner_id, v.moderation_status, v.is_published, v.city, v.lat, v.lng, v.location
      INTO _venue
      FROM public.venues v
     WHERE v.id = p_venue_id;
    IF _venue IS NULL THEN RAISE EXCEPTION 'venue_not_found' USING ERRCODE='42501'; END IF;
    IF _venue.owner_id <> _uid THEN RAISE EXCEPTION 'not_venue_owner' USING ERRCODE='42501'; END IF;
    IF _venue.moderation_status <> 'approved' OR _venue.is_published <> true THEN
      RAISE EXCEPTION 'venue_not_approved' USING ERRCODE='42501';
    END IF;
  ELSE
    -- pentru nearby/followers/city ai nevoie de venue
    IF p_target_kind IN ('nearby','followers','city') THEN
      RAISE EXCEPTION 'venue_required' USING ERRCODE='22023';
    END IF;
  END IF;

  -- rază
  IF p_target_kind = 'nearby' THEN
    IF p_radius_m IS NULL OR p_radius_m < 250 OR p_radius_m > _max_radius THEN
      RAISE EXCEPTION 'invalid_radius' USING ERRCODE='22023';
    END IF;
  END IF;

  -- cotă săptămânală
  _cap := COALESCE((_cfg #> ARRAY['per_plan', _plan, 'weekly_cap'])::text::int, 0);
  SELECT count(*) INTO _used
    FROM public.partner_broadcasts
   WHERE partner_id = _uid
     AND status = 'sent'
     AND created_at > now() - interval '7 days';
  IF _used >= _cap THEN
    RAISE EXCEPTION 'weekly_quota_exceeded' USING ERRCODE='53400',
      HINT=('Ai atins limita săptămânală ('||_cap::text||'). Reia peste 7 zile sau upgrade plan.');
  END IF;

  -- creez rândul (fără destinatari încă)
  INSERT INTO public.partner_broadcasts(
    partner_id, venue_id, title, body, target_kind, radius_m, city, deep_link,
    status, plan_code, sent_at
  ) VALUES (
    _uid, p_venue_id, btrim(p_title), btrim(p_body), p_target_kind,
    CASE WHEN p_target_kind='nearby' THEN p_radius_m ELSE NULL END,
    COALESCE(NULLIF(btrim(p_city),''), _venue.city),
    p_deep_link, 'sent', _plan, now()
  ) RETURNING id INTO _broadcast_id;

  -- construiesc CTE-ul de destinatari, apoi INSERT în notifications
  WITH candidates AS (
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.id <> _uid
      AND p.partner_announcements_enabled = true
      AND p.deleted_at IS NULL
      AND p.banned_at IS NULL
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
         WHERE (b.blocker_id = _uid AND b.blocked_id = p.id)
            OR (b.blocker_id = p.id AND b.blocked_id = _uid)
      )
      -- cooldown per user per partener
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
         WHERE n.user_id = p.id
           AND n.actor_id = _uid
           AND n.type = 'partner_broadcast'
           AND n.created_at > now() - make_interval(hours => _cooldown_h)
      )
      AND (
        (p_target_kind = 'online'
          AND p.last_seen IS NOT NULL
          AND p.last_seen > now() - interval '15 minutes')
        OR (p_target_kind = 'nearby'
          AND p.location IS NOT NULL
          AND _venue.location IS NOT NULL
          AND ST_DWithin(p.location, _venue.location, p_radius_m))
        OR (p_target_kind = 'city'
          AND (
            (_venue.city IS NOT NULL AND p.travel_city = _venue.city)
            OR (p.location IS NOT NULL AND _venue.location IS NOT NULL
                AND ST_DWithin(p.location, _venue.location, 20000))
          ))
        OR (p_target_kind = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.event_rsvps r
              JOIN public.events e ON e.id = r.event_id
             WHERE r.user_id = p.id
               AND (e.host_id = _uid OR e.venue_id = p_venue_id)
          ))
      )
    LIMIT LEAST(_cap_recipients, 10000)
  ),
  ins AS (
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, link, entity_id)
    SELECT c.user_id, _uid, 'partner_broadcast', btrim(p_title), btrim(p_body),
           COALESCE(p_deep_link, CASE WHEN p_venue_id IS NOT NULL THEN '/venues/'||p_venue_id::text ELSE '/explore' END),
           _broadcast_id
      FROM candidates c
    RETURNING 1
  )
  SELECT count(*) INTO _delivered FROM ins;

  SELECT count(*) INTO _targeted FROM public.notifications
    WHERE entity_id = _broadcast_id AND actor_id = _uid;

  UPDATE public.partner_broadcasts
     SET recipients_targeted  = _targeted,
         recipients_delivered = _delivered
   WHERE id = _broadcast_id;

  RETURN jsonb_build_object(
    'ok', true,
    'broadcast_id', _broadcast_id,
    'recipients',   _delivered,
    'remaining',    GREATEST(_cap - (_used + 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_send_broadcast(text,text,text,uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_send_broadcast(text,text,text,uuid,integer,text,text) TO authenticated;

-- 8) RPC ajutător: listez broadcast-urile mele (pentru UI partener)
CREATE OR REPLACE FUNCTION public.partner_list_my_broadcasts(_limit int DEFAULT 30)
RETURNS TABLE(
  id uuid, venue_id uuid, title text, body text, target_kind text,
  radius_m int, city text, recipients_delivered int, recipients_targeted int,
  status text, created_at timestamptz, sent_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.venue_id, b.title, b.body, b.target_kind,
         b.radius_m, b.city, b.recipients_delivered, b.recipients_targeted,
         b.status, b.created_at, b.sent_at
  FROM public.partner_broadcasts b
  WHERE b.partner_id = auth.uid()
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit,30),1), 200);
$$;

REVOKE ALL ON FUNCTION public.partner_list_my_broadcasts(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_list_my_broadcasts(int) TO authenticated;
