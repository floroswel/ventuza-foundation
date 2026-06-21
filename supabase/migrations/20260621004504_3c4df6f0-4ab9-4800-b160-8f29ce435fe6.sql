
-- ============== 1. Profile columns ==============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS prev_location geography(Point,4326),
  ADD COLUMN IF NOT EXISTS prev_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS warned_at timestamptz,
  ADD COLUMN IF NOT EXISTS warned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text;

CREATE INDEX IF NOT EXISTS profiles_risk_score_idx ON public.profiles (risk_score DESC) WHERE risk_score >= 50;

-- ============== 2. Photo hashes ==============
CREATE TABLE IF NOT EXISTS public.photo_hashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  phash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, photo_path)
);

GRANT SELECT, INSERT, DELETE ON public.photo_hashes TO authenticated;
GRANT ALL ON public.photo_hashes TO service_role;
ALTER TABLE public.photo_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own photo hashes" ON public.photo_hashes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own photo hash" ON public.photo_hashes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own photo hash" ON public.photo_hashes
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mods read all photo hashes" ON public.photo_hashes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

CREATE INDEX IF NOT EXISTS photo_hashes_phash_idx ON public.photo_hashes (phash);
CREATE INDEX IF NOT EXISTS photo_hashes_user_idx  ON public.photo_hashes (user_id);

-- ============== 3. Risk flags (moderation queue) ==============
CREATE TABLE IF NOT EXISTS public.risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- 'duplicate_photo' | 'high_risk_score' | 'geo_jump' | 'spam_messages'
  severity int NOT NULL DEFAULT 1,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',   -- open | resolved | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.risk_flags TO authenticated;
GRANT ALL ON public.risk_flags TO service_role;
ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mods read risk flags" ON public.risk_flags
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );
CREATE POLICY "mods update risk flags" ON public.risk_flags
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

CREATE INDEX IF NOT EXISTS risk_flags_open_idx ON public.risk_flags (created_at DESC) WHERE status='open';
CREATE INDEX IF NOT EXISTS risk_flags_user_idx ON public.risk_flags (user_id);

-- ============== 4. record_photo_hash (called from client after upload) ==============
CREATE OR REPLACE FUNCTION public.record_photo_hash(_path text, _phash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _other_users int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _path IS NULL OR length(_path) = 0 THEN RAISE EXCEPTION 'invalid path'; END IF;
  IF _phash IS NULL OR length(_phash) < 8 THEN RAISE EXCEPTION 'invalid phash'; END IF;

  INSERT INTO public.photo_hashes (user_id, photo_path, phash)
  VALUES (_uid, _path, _phash)
  ON CONFLICT (user_id, photo_path) DO UPDATE SET phash = EXCLUDED.phash;

  -- Detect cross-account duplicates
  SELECT count(DISTINCT user_id) INTO _other_users
  FROM public.photo_hashes
  WHERE phash = _phash AND user_id <> _uid;

  IF _other_users > 0 THEN
    INSERT INTO public.risk_flags (user_id, kind, severity, details)
    VALUES (
      _uid, 'duplicate_photo',
      LEAST(5, _other_users + 1),
      jsonb_build_object('phash', _phash, 'path', _path, 'matching_accounts', _other_users)
    );
    -- Also flag the other account(s) so mods see both sides
    INSERT INTO public.risk_flags (user_id, kind, severity, details)
    SELECT DISTINCT ph.user_id, 'duplicate_photo', LEAST(5, _other_users + 1),
      jsonb_build_object('phash', _phash, 'matching_with', _uid)
    FROM public.photo_hashes ph
    WHERE ph.phash = _phash AND ph.user_id <> _uid;

    PERFORM public.recompute_risk_score(_uid);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_photo_hash(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_photo_hash(text,text) TO authenticated;

-- ============== 5. recompute_risk_score ==============
CREATE OR REPLACE FUNCTION public.recompute_risk_score(_uid uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  age_hours numeric;
  msgs_1h int;
  msgs_24h int;
  distinct_recipients_1h int;
  near_dup_msgs int;
  dup_photos int;
  geo_jump_kmh numeric := 0;
  score int := 0;
  signals jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _uid;
  IF p.id IS NULL THEN RETURN 0; END IF;

  age_hours := EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0;

  SELECT count(*), count(DISTINCT m.conversation_id)
    INTO msgs_1h, distinct_recipients_1h
    FROM public.messages m
    WHERE m.sender_id = _uid AND m.created_at > now() - interval '1 hour';
  SELECT count(*) INTO msgs_24h FROM public.messages m
    WHERE m.sender_id = _uid AND m.created_at > now() - interval '24 hours';

  -- Near-identical copy-paste (exact body match in last 24h)
  SELECT COALESCE(max(c),0) INTO near_dup_msgs FROM (
    SELECT count(*) AS c FROM public.messages
     WHERE sender_id = _uid AND created_at > now() - interval '24 hours'
       AND body IS NOT NULL AND length(body) > 8
     GROUP BY lower(body)
  ) g;

  SELECT count(DISTINCT ph2.user_id) INTO dup_photos
    FROM public.photo_hashes ph1
    JOIN public.photo_hashes ph2 ON ph1.phash = ph2.phash AND ph2.user_id <> ph1.user_id
    WHERE ph1.user_id = _uid;

  -- Geo jump velocity (km/h between previous and current location)
  IF p.location IS NOT NULL AND p.prev_location IS NOT NULL AND p.prev_location_at IS NOT NULL THEN
    DECLARE dist_m numeric := ST_Distance(p.location, p.prev_location);
            dt_h   numeric := GREATEST(0.001, EXTRACT(EPOCH FROM (now() - p.prev_location_at))/3600.0);
    BEGIN
      geo_jump_kmh := (dist_m/1000.0) / dt_h;
    END;
  END IF;

  -- Scoring
  IF age_hours < 24 AND msgs_24h > 20 THEN score := score + 25; signals := signals || jsonb_build_object('new_account_high_volume', msgs_24h); END IF;
  IF msgs_1h > 30 THEN score := score + 20; signals := signals || jsonb_build_object('burst_messages_1h', msgs_1h); END IF;
  IF distinct_recipients_1h > 10 THEN score := score + 20; signals := signals || jsonb_build_object('many_recipients_1h', distinct_recipients_1h); END IF;
  IF (p.verified_at IS NULL) AND msgs_24h > 50 THEN score := score + 15; signals := signals || jsonb_build_object('unverified_high_outbound', msgs_24h); END IF;
  IF near_dup_msgs >= 4 THEN score := score + 20; signals := signals || jsonb_build_object('copy_paste_spam', near_dup_msgs); END IF;
  IF dup_photos > 0 THEN score := score + 30; signals := signals || jsonb_build_object('duplicate_photos_with_accounts', dup_photos); END IF;
  IF geo_jump_kmh > 900 THEN score := score + 15; signals := signals || jsonb_build_object('impossible_geo_jump_kmh', round(geo_jump_kmh)); END IF;

  score := LEAST(100, GREATEST(0, score));

  UPDATE public.profiles
     SET risk_score = score,
         risk_signals = signals,
         risk_updated_at = now()
   WHERE id = _uid;

  IF score >= 70 THEN
    INSERT INTO public.risk_flags (user_id, kind, severity, details)
    SELECT _uid, 'high_risk_score', CASE WHEN score>=90 THEN 5 WHEN score>=80 THEN 4 ELSE 3 END, signals
    WHERE NOT EXISTS (
      SELECT 1 FROM public.risk_flags
       WHERE user_id = _uid AND kind = 'high_risk_score' AND status = 'open'
         AND created_at > now() - interval '6 hours'
    );
  END IF;

  RETURN score;
END $$;
REVOKE ALL ON FUNCTION public.recompute_risk_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_risk_score(uuid) TO service_role;

-- ============== 6. Triggers: recompute on message + location change ==============
CREATE OR REPLACE FUNCTION public.trg_msg_risk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_risk_score(NEW.sender_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS msg_recompute_risk ON public.messages;
CREATE TRIGGER msg_recompute_risk AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_msg_risk();

CREATE OR REPLACE FUNCTION public.trg_profile_location_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location IS DISTINCT FROM OLD.location AND OLD.location IS NOT NULL THEN
    NEW.prev_location := OLD.location;
    NEW.prev_location_at := COALESCE(OLD.prev_location_at, OLD.updated_at, OLD.created_at);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_loc_change ON public.profiles;
CREATE TRIGGER profile_loc_change BEFORE UPDATE OF location ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_location_change();

CREATE OR REPLACE FUNCTION public.trg_loc_risk_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location IS DISTINCT FROM OLD.location THEN
    PERFORM public.recompute_risk_score(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_loc_risk ON public.profiles;
CREATE TRIGGER profile_loc_risk AFTER UPDATE OF location ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_loc_risk_after();

-- ============== 7. Moderator action RPCs ==============
CREATE OR REPLACE FUNCTION public.moderator_verify_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET verified = true, verified_at = now(),
    verification_status = 'verified', verification_reason = 'manual moderator approval'
   WHERE id = _target;
END $$;
REVOKE ALL ON FUNCTION public.moderator_verify_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_verify_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderator_warn_user(_target uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET warned_at = now(), warned_reason = _reason WHERE id = _target;
END $$;
REVOKE ALL ON FUNCTION public.moderator_warn_user(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_warn_user(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderator_ban_user(_target uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.moderator_ban_user(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_ban_user(uuid,text) TO authenticated;

-- ============== 8. Admin risk queue RPC ==============
CREATE OR REPLACE FUNCTION public.admin_risk_queue(_limit int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  risk_score int,
  risk_signals jsonb,
  verified boolean,
  report_count int,
  suspended_until timestamptz,
  banned_at timestamptz,
  open_flags int,
  duplicate_photo_accounts int,
  recent_flag_kinds text[],
  last_flag_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH flag_agg AS (
    SELECT rf.user_id,
           count(*) FILTER (WHERE rf.status='open')::int AS open_flags,
           array_agg(DISTINCT rf.kind) AS kinds,
           max(rf.created_at) AS last_at
    FROM public.risk_flags rf
    WHERE rf.created_at > now() - interval '30 days'
    GROUP BY rf.user_id
  ),
  dup AS (
    SELECT ph1.user_id, count(DISTINCT ph2.user_id)::int AS dup_n
    FROM public.photo_hashes ph1
    JOIN public.photo_hashes ph2 ON ph1.phash=ph2.phash AND ph2.user_id<>ph1.user_id
    GROUP BY ph1.user_id
  )
  SELECT p.id, p.display_name, p.risk_score, p.risk_signals,
         (p.verified_at IS NOT NULL), COALESCE(p.report_count,0),
         p.suspended_until, p.banned_at,
         COALESCE(f.open_flags,0), COALESCE(d.dup_n,0),
         COALESCE(f.kinds, ARRAY[]::text[]), f.last_at
    FROM public.profiles p
    LEFT JOIN flag_agg f ON f.user_id = p.id
    LEFT JOIN dup d ON d.user_id = p.id
   WHERE p.risk_score >= 50 OR f.open_flags > 0 OR COALESCE(p.report_count,0) >= 3
   ORDER BY p.risk_score DESC, f.open_flags DESC NULLS LAST, p.report_count DESC NULLS LAST
   LIMIT GREATEST(1, LEAST(_limit, 200));
END $$;
REVOKE ALL ON FUNCTION public.admin_risk_queue(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_risk_queue(int) TO authenticated;

-- ============== 9. Update discover to reduce visibility of risky profiles ==============
CREATE OR REPLACE FUNCTION public.discover_profiles(
  max_distance_km integer DEFAULT 100, min_age integer DEFAULT 18, max_age integer DEFAULT 99,
  looking_for_filter text[] DEFAULT NULL, gender_filter text[] DEFAULT NULL,
  orientation_filter text[] DEFAULT NULL, tribes_filter text[] DEFAULT NULL,
  body_filter text[] DEFAULT NULL, position_filter text[] DEFAULT NULL,
  hiv_filter text[] DEFAULT NULL, min_height integer DEFAULT NULL, max_height integer DEFAULT NULL,
  online_only boolean DEFAULT false, with_photo_only boolean DEFAULT false,
  verified_only boolean DEFAULT false, order_mode text DEFAULT 'score', result_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, display_name text, birthdate date, gender text[], pronouns text[], orientation text[],
  looking_for text[], interests text[], bio text, prompts jsonb, photos text[], last_seen timestamptz,
  tribes text[], body_type text, height_cm integer, weight_kg integer, ethnicity text, "position" text,
  hiv_status text, hiv_test_date date, relationship_status text, verified boolean, distance_m double precision,
  score double precision, boost_until timestamptz, travel_city text, travel_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;
  IF me.suspended_until IS NOT NULL AND me.suspended_until > now() THEN
    RAISE EXCEPTION 'account suspended until %', me.suspended_until;
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.birthdate, p.gender, p.pronouns, p.orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos, p.last_seen,
         p.tribes, p.body_type, p.height_cm, p.weight_kg, p.ethnicity, p."position",
         p.hiv_status, p.hiv_test_date, p.relationship_status,
         (p.verified_at IS NOT NULL) AS verified,
         CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN ST_Distance(me.location, p.location) ELSE NULL END,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))),0)*0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))),0)*0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))),0)*0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' THEN 0.20 ELSE 0 END
           - CASE WHEN p.risk_score >= 50 THEN (p.risk_score::float / 100.0) ELSE 0 END
         ),
         p.boost_until, p.travel_city, p.travel_until
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND COALESCE(p.incognito,false) = false
    AND (p.suspended_until IS NULL OR p.suspended_until <= now())
    AND p.banned_at IS NULL
    AND COALESCE(p.risk_score,0) < 80
    AND p.birthdate IS NOT NULL
    AND date_part('year', age(p.birthdate))::int BETWEEN min_age AND max_age
    AND (looking_for_filter IS NULL OR p.looking_for && looking_for_filter)
    AND (gender_filter IS NULL OR p.gender && gender_filter)
    AND (orientation_filter IS NULL OR p.orientation && orientation_filter)
    AND (tribes_filter IS NULL OR p.tribes && tribes_filter)
    AND (body_filter IS NULL OR p.body_type = ANY(body_filter))
    AND (position_filter IS NULL OR p."position" = ANY(position_filter))
    AND (hiv_filter IS NULL OR p.hiv_status = ANY(hiv_filter))
    AND (min_height IS NULL OR p.height_cm IS NULL OR p.height_cm >= min_height)
    AND (max_height IS NULL OR p.height_cm IS NULL OR p.height_cm <= max_height)
    AND (NOT online_only OR (now() - p.last_seen) < interval '5 minutes')
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND cardinality(p.photos) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
                      WHERE (b.blocker_id=me.id AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=me.id))
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id=me.id AND s.target_id=p.id)
  ORDER BY
    CASE WHEN order_mode='distance' AND me.location IS NOT NULL AND p.location IS NOT NULL
         THEN ST_Distance(me.location, p.location) ELSE NULL END NULLS LAST,
    CASE WHEN order_mode='recent' THEN p.last_seen END DESC NULLS LAST,
    (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC,
    score DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(result_limit, 200));
END $function$;
