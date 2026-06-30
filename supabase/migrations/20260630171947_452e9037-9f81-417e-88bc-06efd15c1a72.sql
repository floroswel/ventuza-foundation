
-- =========================================================================
-- FIX #1: discover_profiles — drop insecure overload, keep rate-limited one
-- =========================================================================

DROP FUNCTION IF EXISTS public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[],
  text[], integer, integer, boolean, boolean, boolean, text, integer, boolean
);

-- Replace the surviving overload with extended public fields (no Art.9 data)
DROP FUNCTION IF EXISTS public.discover_profiles(
  uuid, integer, integer, integer, text[], text[], text[], integer, integer,
  boolean, text, text
);

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
  _tab text DEFAULT 'all',
  _orientation text[] DEFAULT NULL,
  _body text[] DEFAULT NULL,
  _position text[] DEFAULT NULL,
  _min_height integer DEFAULT NULL,
  _max_height integer DEFAULT NULL,
  _online_only boolean DEFAULT false,
  _with_photo_only boolean DEFAULT false,
  _verified_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, display_name text, birthdate date, photos text[],
  pronouns text[], interests text[], prompts jsonb,
  distance_m double precision, last_seen timestamp with time zone,
  tribes text[], verified boolean,
  looking_now_until timestamp with time zone, looking_now_intent text,
  hide_age boolean, hide_distance boolean, hide_online boolean,
  score double precision,
  gender text[], orientation text[], looking_for text[],
  bio text, body_type text, height_cm integer, weight_kg integer,
  ethnicity text, "position" text, relationship_status text,
  boost_until timestamp with time zone,
  travel_city text, travel_until timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loc geography;
  v_calls_last_hour int;
  v_max_per_call constant int := 50;
  v_max_calls_per_hour constant int := 10;
  v_effective_limit int;
BEGIN
  IF _viewer IS NULL OR _viewer <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_account_usable();

  v_effective_limit := LEAST(GREATEST(COALESCE(_limit, 30), 1), v_max_per_call);

  SELECT count(*) INTO v_calls_last_hour
    FROM public.rate_limit_log
    WHERE user_id = _viewer
      AND action  = 'discover_profiles'
      AND created_at > now() - interval '1 hour';

  IF v_calls_last_hour >= v_max_calls_per_hour THEN
    RAISE EXCEPTION 'discover_rate_limited'
      USING ERRCODE = '53400',
            HINT = 'Too many discover requests this hour. Try again later.';
  END IF;

  INSERT INTO public.rate_limit_log(user_id, action) VALUES (_viewer, 'discover_profiles');

  SELECT COALESCE(travel_location, location) INTO v_loc
    FROM public.profiles WHERE id = _viewer;

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
    SELECT * FROM base b
    WHERE (b.dist_m IS NULL OR b.dist_m <= _max_km * 1000)
      AND (b.birthdate IS NULL OR (b.age_years BETWEEN _min_age AND _max_age))
      AND (_genders IS NULL OR b.gender && _genders)
      AND (_tribes IS NULL OR b.tribes && _tribes)
      AND (_looking_for IS NULL OR b.looking_for && _looking_for)
      AND (_orientation IS NULL OR b.orientation && _orientation)
      AND (_body IS NULL OR b.body_type = ANY(_body))
      AND (_position IS NULL OR b."position" = ANY(_position))
      AND (_min_height IS NULL OR b.height_cm IS NULL OR b.height_cm >= _min_height)
      AND (_max_height IS NULL OR b.height_cm IS NULL OR b.height_cm <= _max_height)
      AND (_online_only = false OR (b.last_seen IS NOT NULL AND b.last_seen > now() - interval '15 minutes'))
      AND (_with_photo_only = false OR (b.photos IS NOT NULL AND array_length(b.photos,1) > 0))
      AND (_verified_only = false OR b.verified = true)
      AND (_looking_now_only = false OR (b.looking_now_until IS NOT NULL AND b.looking_now_until > now()))
      AND (
        _tab = 'all'
        OR (_tab = 'online'   AND b.last_seen IS NOT NULL AND b.last_seen > now() - interval '15 minutes')
        OR (_tab = 'fresh'    AND b.created_at > now() - interval '7 days')
        OR (_tab = 'photo'    AND b.photos IS NOT NULL AND array_length(b.photos, 1) > 0)
        OR (_tab = 'now'      AND b.looking_now_until IS NOT NULL AND b.looking_now_until > now())
        OR (_tab = 'verified' AND b.verified = true)
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
    ) AS score,
    f.gender, f.orientation, f.looking_for,
    f.bio, f.body_type, f.height_cm, f.weight_kg,
    f.ethnicity, f."position", f.relationship_status,
    f.boost_until, f.travel_city, f.travel_until
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'distance' THEN f.dist_m END ASC NULLS LAST,
    CASE WHEN _sort = 'newest'   THEN f.created_at END DESC NULLS LAST,
    score DESC NULLS LAST,
    f.last_seen DESC NULLS LAST
  LIMIT v_effective_limit OFFSET GREATEST(COALESCE(_offset,0),0);
END;
$function$;

REVOKE ALL ON FUNCTION public.discover_profiles(
  uuid, integer, integer, integer, text[], text[], text[], integer, integer,
  boolean, text, text, text[], text[], text[], integer, integer, boolean,
  boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(
  uuid, integer, integer, integer, text[], text[], text[], integer, integer,
  boolean, text, text, text[], text[], text[], integer, integer, boolean,
  boolean, boolean
) TO authenticated;

-- =========================================================================
-- FIX #2: Block bilateral enforced at DB level
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.list_my_block_relations()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT blocked_id FROM public.blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id FROM public.blocks WHERE blocked_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_my_block_relations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_block_relations() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_message_when_blocked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_other uuid;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO v_other
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

  IF v_other IS NOT NULL AND public.is_blocked_between(NEW.sender_id, v_other) THEN
    RAISE EXCEPTION 'blocked_recipient'
      USING ERRCODE = '42501',
            HINT = 'You cannot send messages to a user you have blocked or who has blocked you.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_when_blocked ON public.messages;
CREATE TRIGGER trg_prevent_message_when_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_message_when_blocked();
