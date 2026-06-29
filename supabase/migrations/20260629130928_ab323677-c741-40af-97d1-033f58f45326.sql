
CREATE OR REPLACE FUNCTION public.assert_age_verified()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_status text; v_enforce boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(enabled, true) INTO v_enforce FROM public.feature_flags WHERE key = 'age_verification';
  IF v_enforce IS NULL THEN v_enforce := true; END IF;
  IF NOT v_enforce THEN RETURN; END IF;
  SELECT age_status INTO v_status FROM public.profiles WHERE id = auth.uid();
  IF v_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'age_verification_required' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assert_age_verified() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_age_verified() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.discover_profiles(
  _viewer uuid,
  _max_km integer DEFAULT 100,
  _min_age integer DEFAULT 18,
  _max_age integer DEFAULT 99,
  _genders text[] DEFAULT NULL,
  _tribes text[] DEFAULT NULL,
  _looking_for text[] DEFAULT NULL,
  _limit integer DEFAULT 30,
  _offset integer DEFAULT 0,
  _looking_now_only boolean DEFAULT false,
  _sort text DEFAULT 'smart',
  _tab text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, photos text[], pronouns text[],
  interests text[], prompts jsonb, distance_m double precision,
  last_seen timestamp with time zone, tribes text[], verified boolean,
  looking_now_until timestamp with time zone, looking_now_intent text,
  hide_age boolean, hide_distance boolean, hide_online boolean, score double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_loc geography;
BEGIN
  IF _viewer IS NULL OR _viewer <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.assert_age_verified();
  SELECT COALESCE(travel_location, location) INTO v_loc FROM public.profiles WHERE id = _viewer;
  RETURN QUERY
  WITH base AS (
    SELECT p.*,
      CASE WHEN v_loc IS NOT NULL AND p.location IS NOT NULL
           THEN ST_Distance(v_loc, p.location) ELSE NULL END AS dist_m,
      EXTRACT(YEAR FROM age(p.birthdate))::int AS age_years,
      COALESCE(array_length(p.photos,1),0) AS photo_count,
      (EXISTS(SELECT 1 FROM public.taps t  WHERE t.from_user = p.id AND t.to_user = _viewer AND t.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.woofs w WHERE w.from_user = p.id AND w.to_user = _viewer AND w.created_at > now() - interval '14 days')
       OR EXISTS(SELECT 1 FROM public.favorites f WHERE f.user_id = p.id AND f.favorite_id = _viewer)
      ) AS mutual_interest
    FROM public.profiles p
    WHERE p.id <> _viewer
      AND p.onboarding_completed = true
      AND p.deleted_at IS NULL
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      AND p.banned_at IS NULL
      AND p.incognito IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = _viewer))
      AND NOT EXISTS (SELECT 1 FROM public.swipes s
        WHERE s.swiper_id = _viewer AND s.swipee_id = p.id)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (dist_m IS NULL OR dist_m <= _max_km * 1000)
      AND (birthdate IS NULL OR (age_years BETWEEN _min_age AND _max_age))
      AND (_genders IS NULL OR gender && _genders)
      AND (_tribes IS NULL OR tribes && _tribes)
      AND (_looking_for IS NULL OR looking_for && _looking_for)
      AND (_looking_now_only = false OR (looking_now_until IS NOT NULL AND looking_now_until > now()))
      AND (
        _tab = 'all'
        OR (_tab = 'online'   AND last_seen IS NOT NULL AND last_seen > now() - interval '15 minutes')
        OR (_tab = 'fresh'    AND created_at > now() - interval '7 days')
        OR (_tab = 'photo'    AND photos IS NOT NULL AND array_length(photos, 1) > 0)
        OR (_tab = 'now'      AND looking_now_until IS NOT NULL AND looking_now_until > now())
        OR (_tab = 'verified' AND verified = true)
      )
  )
  SELECT
    f.id, f.display_name,
    CASE
      WHEN f.hide_age THEN NULL
      WHEN f.birthdate IS NULL THEN NULL
      ELSE make_date(EXTRACT(YEAR FROM f.birthdate)::int, 1, 1)
    END AS birthdate,
    f.photos, f.pronouns, f.interests, f.prompts,
    public.bucket_distance_m(f.dist_m) AS distance_m,
    CASE WHEN f.hide_online THEN NULL ELSE f.last_seen END AS last_seen,
    f.tribes, f.verified, f.looking_now_until, f.looking_now_intent,
    f.hide_age, f.hide_distance, f.hide_online,
    (
        CASE WHEN f.looking_now_until IS NOT NULL AND f.looking_now_until > now() THEN 0.40 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '15 minutes' THEN 0.20 ELSE 0.0 END
      + CASE WHEN f.last_seen IS NOT NULL AND f.last_seen > now() - interval '1 hour'    THEN 0.05 ELSE 0.0 END
      + CASE WHEN f.verified THEN 0.10 ELSE 0.0 END
      + CASE WHEN f.boost_until IS NOT NULL AND f.boost_until > now() THEN 0.30 ELSE 0.0 END
      + CASE WHEN f.dist_m IS NOT NULL THEN greatest(0.0, 0.25 - (f.dist_m/1000.0)/200.0) ELSE 0.0 END
      + CASE WHEN f.mutual_interest THEN 0.35 ELSE 0.0 END
      + (COALESCE(f.profile_completion,0)::double precision / 100.0) * 0.15
      + LEAST(f.photo_count, 6) * 0.02
      - LEAST(coalesce(f.risk_score,0)::double precision / 200.0, 0.5)
    )::double precision AS score
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'distance' THEN f.dist_m END NULLS LAST,
    CASE WHEN _sort = 'recent'   THEN f.last_seen END DESC NULLS LAST,
    score DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.discover_profiles(uuid,integer,integer,integer,text[],text[],text[],integer,integer,boolean,text,text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_profiles(uuid,integer,integer,integer,text[],text[],text[],integer,integer,boolean,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); a uuid; b uuid; cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.assert_age_verified();
  IF _other IS NULL OR _other = me THEN RAISE EXCEPTION 'invalid recipient'; END IF;
  IF me < _other THEN a := me; b := _other; ELSE a := _other; b := me; END IF;
  SELECT id INTO cid FROM public.conversations WHERE user_a = a AND user_b = b;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  INSERT INTO public.conversations (user_a, user_b) VALUES (a, b) RETURNING id INTO cid;
  RETURN cid;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_looking_now(_intent text, _hours integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); h integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.assert_age_verified();
  h := LEAST(GREATEST(COALESCE(_hours, 1), 1), 12);
  UPDATE public.profiles
     SET looking_now_intent = NULLIF(_intent, ''),
         looking_now_until = now() + (h || ' hours')::interval
   WHERE id = me;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_looking_now(text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_looking_now(text, integer) TO authenticated, service_role;

-- M2: offers no self-publish
DROP POLICY IF EXISTS "Venue owner manages offers" ON public.offers;
DROP POLICY IF EXISTS "Venue owner inserts offers (pending)" ON public.offers;
DROP POLICY IF EXISTS "Venue owner updates own offers (no self-publish)" ON public.offers;
DROP POLICY IF EXISTS "Venue owner deletes own offers" ON public.offers;
DROP POLICY IF EXISTS "Venue owner reads own offers" ON public.offers;

CREATE POLICY "Venue owner inserts offers (pending)"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = offers.venue_id AND v.owner_id = auth.uid())
    AND COALESCE(is_published, false) = false
    AND COALESCE(moderation_status::text, 'pending') <> 'approved'
  );
CREATE POLICY "Venue owner updates own offers (no self-publish)"
  ON public.offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = offers.venue_id AND v.owner_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = offers.venue_id AND v.owner_id = auth.uid())
    AND COALESCE(is_published, false) = false
  );
CREATE POLICY "Venue owner deletes own offers"
  ON public.offers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = offers.venue_id AND v.owner_id = auth.uid()));
CREATE POLICY "Venue owner reads own offers"
  ON public.offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = offers.venue_id AND v.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.offers_no_self_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                              OR (current_user IN ('service_role','postgres','supabase_admin'));
        is_staff_caller boolean := false;
BEGIN
  IF is_service THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator']::app_role[]) INTO is_staff_caller;
  END IF;
  IF is_staff_caller THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_published := false;
    IF NEW.moderation_status::text = 'approved' THEN
      NEW.moderation_status := 'pending'::moderation_status;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_published IS DISTINCT FROM OLD.is_published AND NEW.is_published = true THEN
      RAISE EXCEPTION 'offer_self_publish_forbidden' USING ERRCODE='42501';
    END IF;
    IF OLD.moderation_status::text = 'approved' AND (
        NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
     ) THEN
      NEW.moderation_status := 'pending'::moderation_status;
      NEW.is_published := false;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_offers_no_self_publish ON public.offers;
CREATE TRIGGER trg_offers_no_self_publish
  BEFORE INSERT OR UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_no_self_publish();

-- M3
DROP POLICY IF EXISTS "Anyone files dsa report" ON public.illegal_content_reports;
DROP POLICY IF EXISTS "Authenticated files dsa report" ON public.illegal_content_reports;
CREATE POLICY "Authenticated files dsa report"
  ON public.illegal_content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id IS NULL OR reporter_user_id = auth.uid());

-- M4
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'admin\_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- M5
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid='public.app_settings'::regclass LOOP
    EXECUTE format('DROP POLICY %I ON public.app_settings', r.polname);
  END LOOP;
END $$;
CREATE POLICY "app_settings public-safe keys"
  ON public.app_settings FOR SELECT TO authenticated
  USING (key NOT IN ('billing_settings') AND key NOT LIKE 'rate_limits.%');
CREATE POLICY "app_settings staff full read"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator','auditor','support']::app_role[]));

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid='public.feature_flags'::regclass LOOP
    EXECUTE format('DROP POLICY %I ON public.feature_flags', r.polname);
  END LOOP;
END $$;
CREATE POLICY "feature_flags read authenticated"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "feature_flags write staff"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- M6
CREATE OR REPLACE FUNCTION public.sos_purge_old_coords()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.sos_events
     SET latitude = NULL, longitude = NULL
   WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
     AND triggered_at < now() - interval '24 hours';
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_sos_purge_old_coords ON public.sos_events;
CREATE TRIGGER trg_sos_purge_old_coords
  AFTER INSERT ON public.sos_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.sos_purge_old_coords();

-- m1
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                              OR (current_user IN ('service_role','postgres','supabase_admin'));
BEGIN
  IF is_service THEN RETURN NEW; END IF;
  IF NEW.verified                  IS DISTINCT FROM OLD.verified                  THEN NEW.verified                  := OLD.verified;                  END IF;
  IF NEW.verified_at               IS DISTINCT FROM OLD.verified_at               THEN NEW.verified_at               := OLD.verified_at;               END IF;
  IF NEW.age_verified_at           IS DISTINCT FROM OLD.age_verified_at           THEN NEW.age_verified_at           := OLD.age_verified_at;           END IF;
  IF NEW.age_status                IS DISTINCT FROM OLD.age_status                THEN NEW.age_status                := OLD.age_status;                END IF;
  IF NEW.age_provider              IS DISTINCT FROM OLD.age_provider              THEN NEW.age_provider              := OLD.age_provider;              END IF;
  IF NEW.verification_status       IS DISTINCT FROM OLD.verification_status       THEN NEW.verification_status       := OLD.verification_status;       END IF;
  IF NEW.verification_reason       IS DISTINCT FROM OLD.verification_reason       THEN NEW.verification_reason       := OLD.verification_reason;       END IF;
  IF NEW.verification_selfie_path  IS DISTINCT FROM OLD.verification_selfie_path  THEN NEW.verification_selfie_path  := OLD.verification_selfie_path;  END IF;
  IF NEW.banned_at                 IS DISTINCT FROM OLD.banned_at                 THEN NEW.banned_at                 := OLD.banned_at;                 END IF;
  IF NEW.banned_reason             IS DISTINCT FROM OLD.banned_reason             THEN NEW.banned_reason             := OLD.banned_reason;             END IF;
  IF NEW.suspended_until           IS DISTINCT FROM OLD.suspended_until           THEN NEW.suspended_until           := OLD.suspended_until;           END IF;
  IF NEW.suspended_reason          IS DISTINCT FROM OLD.suspended_reason          THEN NEW.suspended_reason          := OLD.suspended_reason;          END IF;
  IF NEW.warned_at                 IS DISTINCT FROM OLD.warned_at                 THEN NEW.warned_at                 := OLD.warned_at;                 END IF;
  IF NEW.warned_reason             IS DISTINCT FROM OLD.warned_reason             THEN NEW.warned_reason             := OLD.warned_reason;             END IF;
  IF NEW.report_count              IS DISTINCT FROM OLD.report_count              THEN NEW.report_count              := OLD.report_count;              END IF;
  IF NEW.risk_score                IS DISTINCT FROM OLD.risk_score                THEN NEW.risk_score                := OLD.risk_score;                END IF;
  IF NEW.risk_signals              IS DISTINCT FROM OLD.risk_signals              THEN NEW.risk_signals              := OLD.risk_signals;              END IF;
  IF NEW.risk_updated_at           IS DISTINCT FROM OLD.risk_updated_at           THEN NEW.risk_updated_at           := OLD.risk_updated_at;           END IF;
  IF NEW.boost_until               IS DISTINCT FROM OLD.boost_until               THEN NEW.boost_until               := OLD.boost_until;               END IF;
  IF NEW.boosts_balance            IS DISTINCT FROM OLD.boosts_balance            THEN NEW.boosts_balance            := OLD.boosts_balance;            END IF;
  IF NEW.super_taps_balance        IS DISTINCT FROM OLD.super_taps_balance        THEN NEW.super_taps_balance        := OLD.super_taps_balance;        END IF;
  IF NEW.xp                        IS DISTINCT FROM OLD.xp                        THEN NEW.xp                        := OLD.xp;                        END IF;
  IF NEW.level                     IS DISTINCT FROM OLD.level                     THEN NEW.level                     := OLD.level;                     END IF;
  IF NEW.streak_days               IS DISTINCT FROM OLD.streak_days               THEN NEW.streak_days               := OLD.streak_days;               END IF;
  IF NEW.partner_suspended_at      IS DISTINCT FROM OLD.partner_suspended_at      THEN NEW.partner_suspended_at      := OLD.partner_suspended_at;      END IF;
  IF NEW.health_data_consent_at    IS DISTINCT FROM OLD.health_data_consent_at    THEN NEW.health_data_consent_at    := OLD.health_data_consent_at;    END IF;
  IF NEW.hiv_status_enc            IS DISTINCT FROM OLD.hiv_status_enc            THEN NEW.hiv_status_enc            := OLD.hiv_status_enc;            END IF;
  IF NEW.hiv_test_date_enc         IS DISTINCT FROM OLD.hiv_test_date_enc         THEN NEW.hiv_test_date_enc         := OLD.hiv_test_date_enc;         END IF;
  IF NEW.id                        IS DISTINCT FROM OLD.id                        THEN NEW.id                        := OLD.id;                        END IF;
  IF NEW.created_at                IS DISTINCT FROM OLD.created_at                THEN NEW.created_at                := OLD.created_at;                END IF;
  IF NEW.profile_slug              IS DISTINCT FROM OLD.profile_slug              THEN NEW.profile_slug              := OLD.profile_slug;              END IF;
  IF NEW.deleted_at                IS DISTINCT FROM OLD.deleted_at                THEN NEW.deleted_at                := OLD.deleted_at;                END IF;
  IF NEW.incognito IS DISTINCT FROM OLD.incognito THEN
    IF NEW.incognito = true AND (
      OLD.banned_at IS NOT NULL
      OR (OLD.suspended_until IS NOT NULL AND OLD.suspended_until > now())
      OR OLD.partner_suspended_at IS NOT NULL
    ) THEN
      NEW.incognito := OLD.incognito;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- m3
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid='public.rate_limit_log'::regclass LOOP
    EXECUTE format('DROP POLICY %I ON public.rate_limit_log', r.polname);
  END LOOP;
END $$;
CREATE POLICY "rate_limit_log staff read"
  ON public.rate_limit_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','auditor']::app_role[]));
