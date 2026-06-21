
-- ============== 1. Profile additions ==============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS looking_now_until timestamptz,
  ADD COLUMN IF NOT EXISTS looking_now_intent text,
  ADD COLUMN IF NOT EXISTS hide_age boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_distance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_online boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_looking_now_idx
  ON public.profiles (looking_now_until) WHERE looking_now_until IS NOT NULL;

-- ============== 2. Taps ==============
CREATE TABLE IF NOT EXISTS public.taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id),
  CHECK (length(emoji) BETWEEN 1 AND 16)
);
GRANT SELECT, INSERT, DELETE ON public.taps TO authenticated;
GRANT ALL ON public.taps TO service_role;
ALTER TABLE public.taps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own taps" ON public.taps FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "send tap" ON public.taps FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
         OR (b.blocker_id = sender_id AND b.blocked_id = receiver_id)));
CREATE POLICY "delete own tap" ON public.taps FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS taps_receiver_idx ON public.taps (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taps_sender_idx ON public.taps (sender_id, created_at DESC);

-- Rate limit: max 60 taps/hour, max 10/min
CREATE OR REPLACE FUNCTION public.enforce_tap_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c1 int; c2 int;
BEGIN
  SELECT count(*) INTO c1 FROM public.taps
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute';
  IF c1 >= 10 THEN RAISE EXCEPTION 'Too many taps. Slow down.'; END IF;
  SELECT count(*) INTO c2 FROM public.taps
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 hour';
  IF c2 >= 60 THEN RAISE EXCEPTION 'Tap limit reached (60/hour).'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_tap_rate_limit() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS taps_rate_limit ON public.taps;
CREATE TRIGGER taps_rate_limit BEFORE INSERT ON public.taps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tap_rate_limit();

-- Notify on tap
CREATE OR REPLACE FUNCTION public.notify_on_tap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_name text;
BEGIN
  SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, payload)
  VALUES (NEW.receiver_id, 'tap', NEW.sender_id,
    jsonb_build_object('emoji', NEW.emoji, 'sender_name', _sender_name));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_on_tap() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS taps_notify ON public.taps;
CREATE TRIGGER taps_notify AFTER INSERT ON public.taps
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_tap();

ALTER PUBLICATION supabase_realtime ADD TABLE public.taps;

-- ============== 3. Favorites ==============
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, favorite_id),
  CHECK (user_id <> favorite_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites read" ON public.favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own favorites add" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own favorites delete" ON public.favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id, created_at DESC);

-- ============== 4. Message reactions ==============
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.toggle_message_reaction(_msg_id uuid, _emoji text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _msg public.messages%ROWTYPE;
  _conv public.conversations%ROWTYPE;
  _users jsonb;
  _new jsonb;
  _arr text[];
  _existing text;
  ALLOWED text[] := ARRAY['❤️','🔥','😂','😮','😢','👍'];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (_emoji = ANY(ALLOWED)) THEN RAISE EXCEPTION 'emoji not allowed'; END IF;
  SELECT * INTO _msg FROM public.messages WHERE id = _msg_id;
  IF _msg.id IS NULL THEN RAISE EXCEPTION 'message not found'; END IF;
  SELECT * INTO _conv FROM public.conversations WHERE id = _msg.conversation_id;
  IF _conv.user_a <> _uid AND _conv.user_b <> _uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _new := COALESCE(_msg.reactions, '{}'::jsonb);
  _users := _new -> _emoji;
  IF _users IS NULL THEN
    _new := _new || jsonb_build_object(_emoji, jsonb_build_array(_uid::text));
  ELSE
    SELECT array_agg(value) INTO _arr FROM jsonb_array_elements_text(_users);
    IF _uid::text = ANY(_arr) THEN
      _arr := array_remove(_arr, _uid::text);
    ELSE
      _arr := array_append(_arr, _uid::text);
    END IF;
    IF array_length(_arr,1) IS NULL OR array_length(_arr,1) = 0 THEN
      _new := _new - _emoji;
    ELSE
      _new := jsonb_set(_new, ARRAY[_emoji], to_jsonb(_arr));
    END IF;
  END IF;

  UPDATE public.messages SET reactions = _new WHERE id = _msg_id;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.toggle_message_reaction(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid,text) TO authenticated;

-- ============== 5. set_looking_now ==============
CREATE OR REPLACE FUNCTION public.set_looking_now(_hours int, _intent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _hours <= 0 THEN
    UPDATE public.profiles SET looking_now_until = NULL, looking_now_intent = NULL WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles
       SET looking_now_until = now() + (LEAST(_hours,12) || ' hours')::interval,
           looking_now_intent = NULLIF(left(coalesce(_intent,''), 80), '')
     WHERE id = auth.uid();
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_looking_now(int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_looking_now(int,text) TO authenticated;

-- ============== 6. Update discover_profiles: privacy masking + looking_now filter ==============
CREATE OR REPLACE FUNCTION public.discover_profiles(
  max_distance_km integer DEFAULT 100, min_age integer DEFAULT 18, max_age integer DEFAULT 99,
  looking_for_filter text[] DEFAULT NULL, gender_filter text[] DEFAULT NULL,
  orientation_filter text[] DEFAULT NULL, tribes_filter text[] DEFAULT NULL,
  body_filter text[] DEFAULT NULL, position_filter text[] DEFAULT NULL,
  hiv_filter text[] DEFAULT NULL, min_height integer DEFAULT NULL, max_height integer DEFAULT NULL,
  online_only boolean DEFAULT false, with_photo_only boolean DEFAULT false,
  verified_only boolean DEFAULT false, order_mode text DEFAULT 'score', result_limit integer DEFAULT 60,
  looking_now_only boolean DEFAULT false)
RETURNS TABLE(id uuid, display_name text, birthdate date, gender text[], pronouns text[], orientation text[],
  looking_for text[], interests text[], bio text, prompts jsonb, photos text[], last_seen timestamptz,
  tribes text[], body_type text, height_cm integer, weight_kg integer, ethnicity text, "position" text,
  hiv_status text, hiv_test_date date, relationship_status text, verified boolean, distance_m double precision,
  score double precision, boost_until timestamptz, travel_city text, travel_until timestamptz,
  looking_now_until timestamptz, looking_now_intent text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles pr WHERE pr.id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;
  IF me.suspended_until IS NOT NULL AND me.suspended_until > now() THEN
    RAISE EXCEPTION 'account suspended until %', me.suspended_until;
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name,
         CASE WHEN p.hide_age THEN NULL ELSE p.birthdate END,
         p.gender, p.pronouns, p.orientation,
         p.looking_for, p.interests, p.bio, p.prompts, p.photos,
         CASE WHEN p.hide_online THEN NULL ELSE p.last_seen END,
         p.tribes, p.body_type, p.height_cm, p.weight_kg, p.ethnicity, p."position",
         p.hiv_status, p.hiv_test_date, p.relationship_status,
         (p.verified_at IS NOT NULL),
         CASE WHEN p.hide_distance THEN NULL
              WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN ST_Distance(me.location, p.location) ELSE NULL END,
         (
           CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
                THEN GREATEST(0, 1 - (ST_Distance(me.location, p.location) / (max_distance_km * 1000.0)))
                ELSE 0 END
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(me.interests))),0)*0.15
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.looking_for) INTERSECT SELECT unnest(me.looking_for))),0)*0.25
           + COALESCE(cardinality(ARRAY(SELECT unnest(p.tribes) INTERSECT SELECT unnest(me.tribes))),0)*0.30
           + CASE WHEN p.verified_at IS NOT NULL THEN 0.15 ELSE 0 END
           + CASE WHEN (now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online THEN 0.20 ELSE 0 END
           + CASE WHEN p.looking_now_until IS NOT NULL AND p.looking_now_until > now() THEN 0.40 ELSE 0 END
           - CASE WHEN p.risk_score >= 50 THEN (p.risk_score::float / 100.0) ELSE 0 END
         ),
         p.boost_until, p.travel_city, p.travel_until,
         p.looking_now_until, p.looking_now_intent
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
    AND (NOT online_only OR ((now() - p.last_seen) < interval '5 minutes' AND NOT p.hide_online))
    AND (NOT with_photo_only OR (p.photos IS NOT NULL AND cardinality(p.photos) > 0))
    AND (NOT verified_only OR p.verified_at IS NOT NULL)
    AND (NOT looking_now_only OR (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()))
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
                      WHERE (b.blocker_id=me.id AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=me.id))
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id=me.id AND s.target_id=p.id)
  ORDER BY
    (p.looking_now_until IS NOT NULL AND p.looking_now_until > now()) DESC,
    CASE WHEN order_mode='distance' AND me.location IS NOT NULL AND p.location IS NOT NULL
         THEN ST_Distance(me.location, p.location) ELSE NULL END NULLS LAST,
    CASE WHEN order_mode='recent' THEN p.last_seen END DESC NULLS LAST,
    (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC,
    score DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(result_limit, 200));
END $function$;
