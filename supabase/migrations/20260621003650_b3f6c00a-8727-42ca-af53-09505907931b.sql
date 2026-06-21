
-- =========================================================================
-- 1. LOCK DOWN INTERNAL SECURITY DEFINER FUNCTIONS
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, uuid, notification_type, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_report_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_swipe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_swipe_rate_limit() FROM PUBLIC, anon, authenticated;
-- moderator_suspend_user: only authenticated (self-checks role inside)
REVOKE EXECUTE ON FUNCTION public.moderator_suspend_user(uuid, integer, text) FROM PUBLIC, anon;

-- =========================================================================
-- 2. GENERIC RATE-LIMIT HELPER + DEDICATED ENFORCERS
-- =========================================================================

-- ---- MESSAGES: max 20/min, 300/hour per sender ----
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min int;
  c_hour int;
  body_clean text;
  link_count int;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RAISE EXCEPTION 'sender required';
  END IF;
  IF NEW.sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'cannot send as another user';
  END IF;

  -- Validation: length + not-only-link
  body_clean := btrim(coalesce(NEW.body, ''));
  IF length(body_clean) = 0 THEN
    RAISE EXCEPTION 'message cannot be empty';
  END IF;
  IF length(body_clean) > 2000 THEN
    RAISE EXCEPTION 'message too long (max 2000)';
  END IF;
  -- Reject if message is *only* URLs/whitespace
  IF body_clean ~* '^(\s|https?://\S+|www\.\S+)+$' AND body_clean ~* 'https?://|www\.' THEN
    RAISE EXCEPTION 'messages cannot consist only of links';
  END IF;
  -- Cap to max 3 links per message
  link_count := (length(body_clean) - length(regexp_replace(body_clean, 'https?://', '', 'g'))) / 7;
  IF link_count > 3 THEN
    RAISE EXCEPTION 'too many links in one message';
  END IF;

  SELECT count(*) INTO c_min FROM public.messages
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute';
  IF c_min >= 20 THEN
    RAISE EXCEPTION 'message rate limit: max 20 per minute';
  END IF;
  SELECT count(*) INTO c_hour FROM public.messages
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 hour';
  IF c_hour >= 300 THEN
    RAISE EXCEPTION 'message rate limit: max 300 per hour';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_rate_limit ON public.messages;
CREATE TRIGGER messages_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ---- PROFILE_VIEWS: 200/hour per viewer ----
CREATE OR REPLACE FUNCTION public.enforce_profile_view_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c int;
BEGIN
  IF NEW.viewer_id IS NULL OR NEW.viewer_id <> auth.uid() THEN
    RAISE EXCEPTION 'invalid viewer';
  END IF;
  SELECT count(*) INTO c FROM public.profile_views
    WHERE viewer_id = NEW.viewer_id AND viewed_at > now() - interval '1 hour';
  IF c >= 200 THEN
    RAISE EXCEPTION 'profile view rate limit: max 200 per hour';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_view_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_views_rate_limit ON public.profile_views;
CREATE TRIGGER profile_views_rate_limit
  BEFORE INSERT ON public.profile_views
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_view_rate_limit();

-- ---- ALBUM_REQUESTS: 30/hour per requester ----
CREATE OR REPLACE FUNCTION public.enforce_album_request_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c int;
BEGIN
  IF NEW.requester_id IS NULL OR NEW.requester_id <> auth.uid() THEN
    RAISE EXCEPTION 'invalid requester';
  END IF;
  SELECT count(*) INTO c FROM public.album_requests
    WHERE requester_id = NEW.requester_id AND created_at > now() - interval '1 hour';
  IF c >= 30 THEN
    RAISE EXCEPTION 'album request rate limit: max 30 per hour';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_album_request_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS album_requests_rate_limit ON public.album_requests;
CREATE TRIGGER album_requests_rate_limit
  BEFORE INSERT ON public.album_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_album_request_rate_limit();

-- ---- REPORTS: 10/day per reporter, and details validation ----
CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c int;
BEGIN
  IF NEW.reporter_id IS NULL OR NEW.reporter_id <> auth.uid() THEN
    RAISE EXCEPTION 'invalid reporter';
  END IF;
  IF NEW.reporter_id = NEW.reported_id THEN
    RAISE EXCEPTION 'cannot report yourself';
  END IF;
  IF NEW.details IS NOT NULL AND length(NEW.details) > 1000 THEN
    RAISE EXCEPTION 'report details too long (max 1000)';
  END IF;
  SELECT count(*) INTO c FROM public.reports
    WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '24 hours';
  IF c >= 10 THEN
    RAISE EXCEPTION 'report rate limit: max 10 per day';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_rate_limit ON public.reports;
CREATE TRIGGER reports_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_rate_limit();

-- =========================================================================
-- 3. PROFILE BIO SERVER-SIDE VALIDATION
-- =========================================================================
CREATE OR REPLACE FUNCTION public.validate_profile_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bio_clean text;
BEGIN
  IF NEW.bio IS NOT NULL THEN
    bio_clean := btrim(NEW.bio);
    IF length(bio_clean) > 1000 THEN
      RAISE EXCEPTION 'bio too long (max 1000)';
    END IF;
    -- Reject bio that is only links
    IF length(bio_clean) > 0
       AND bio_clean ~* 'https?://|www\.'
       AND bio_clean ~* '^(\s|https?://\S+|www\.\S+)+$' THEN
      RAISE EXCEPTION 'bio cannot consist only of links';
    END IF;
  END IF;
  IF NEW.display_name IS NOT NULL AND length(NEW.display_name) > 80 THEN
    RAISE EXCEPTION 'display_name too long';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_profile_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_validate_text ON public.profiles;
CREATE TRIGGER profiles_validate_text
  BEFORE INSERT OR UPDATE OF bio, display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_text();

-- =========================================================================
-- 4. SOFT-BAN AUTOMATION (5 distinct reporters → 72h auto-suspend)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.auto_soft_ban_on_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  distinct_reporters int;
  current_suspend timestamptz;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO distinct_reporters
    FROM public.reports
    WHERE reported_id = NEW.reported_id
      AND created_at > now() - interval '30 days';

  IF distinct_reporters >= 5 THEN
    SELECT suspended_until INTO current_suspend
      FROM public.profiles WHERE id = NEW.reported_id;
    IF current_suspend IS NULL OR current_suspend < now() + interval '1 hour' THEN
      UPDATE public.profiles
        SET suspended_until = now() + interval '72 hours',
            suspended_reason = coalesce(suspended_reason, 'auto: ' || distinct_reporters || ' distinct reports — pending moderator review')
        WHERE id = NEW.reported_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auto_soft_ban_on_reports() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_auto_soft_ban ON public.reports;
CREATE TRIGGER reports_auto_soft_ban
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_soft_ban_on_reports();

-- =========================================================================
-- 5. HIDE SUSPENDED PROFILES FROM DISCOVER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.discover_profiles(max_distance_km integer DEFAULT 100, min_age integer DEFAULT 18, max_age integer DEFAULT 99, looking_for_filter text[] DEFAULT NULL::text[], gender_filter text[] DEFAULT NULL::text[], orientation_filter text[] DEFAULT NULL::text[], tribes_filter text[] DEFAULT NULL::text[], body_filter text[] DEFAULT NULL::text[], position_filter text[] DEFAULT NULL::text[], hiv_filter text[] DEFAULT NULL::text[], min_height integer DEFAULT NULL::integer, max_height integer DEFAULT NULL::integer, online_only boolean DEFAULT false, with_photo_only boolean DEFAULT false, verified_only boolean DEFAULT false, order_mode text DEFAULT 'score'::text, result_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, display_name text, birthdate date, gender text[], pronouns text[], orientation text[], looking_for text[], interests text[], bio text, prompts jsonb, photos text[], last_seen timestamp with time zone, tribes text[], body_type text, height_cm integer, weight_kg integer, ethnicity text, "position" text, hiv_status text, hiv_test_date date, relationship_status text, verified boolean, distance_m double precision, score double precision, boost_until timestamp with time zone, travel_city text, travel_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
              THEN ST_Distance(me.location, p.location) ELSE NULL END AS distance_m,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))), 0) * 0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))), 0) * 0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))), 0) * 0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' THEN 0.20 ELSE 0 END
         ) AS score,
         p.boost_until, p.travel_city, p.travel_until
  FROM public.profiles p
  WHERE p.id <> me.id
    AND p.onboarding_completed = true
    AND COALESCE(p.incognito, false) = false
    AND (p.suspended_until IS NULL OR p.suspended_until <= now())
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
                      WHERE (b.blocker_id = me.id AND b.blocked_id = p.id)
                         OR (b.blocker_id = p.id AND b.blocked_id = me.id))
    AND NOT EXISTS (SELECT 1 FROM public.swipes s
                      WHERE s.swiper_id = me.id AND s.target_id = p.id)
  ORDER BY
    CASE WHEN order_mode = 'distance' AND me.location IS NOT NULL AND p.location IS NOT NULL
         THEN ST_Distance(me.location, p.location) ELSE NULL END NULLS LAST,
    CASE WHEN order_mode = 'recent' THEN p.last_seen END DESC NULLS LAST,
    (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC,
    score DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(result_limit, 200));
END;
$function$;

-- Index to make rate-limit lookups cheap
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_views_viewer_at_idx ON public.profile_views(viewer_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS album_requests_requester_created_idx ON public.album_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reporter_created_idx ON public.reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_created_idx ON public.reports(reported_id, created_at DESC);
