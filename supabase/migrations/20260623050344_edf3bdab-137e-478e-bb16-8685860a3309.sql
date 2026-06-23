
-- Opt-in flag for leaderboard
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT true;

-- Quest templates (static catalog)
CREATE TABLE IF NOT EXISTS public.quest_templates (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  metric text NOT NULL,
  target integer NOT NULL,
  xp_reward integer NOT NULL,
  bonus_kind text,
  bonus_amount integer,
  icon text NOT NULL DEFAULT 'sparkles',
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.quest_templates TO authenticated, anon;
GRANT ALL ON public.quest_templates TO service_role;
ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY quest_templates_read ON public.quest_templates FOR SELECT USING (true);

INSERT INTO public.quest_templates (id, title, description, metric, target, xp_reward, bonus_kind, bonus_amount, icon, sort_order) VALUES
  ('send_messages',   'Trimite 10 mesaje',          'Trimite 10 mesaje către alți utilizatori',          'messages_sent',    10, 80,  'super_taps', 1, 'message-circle', 1),
  ('receive_taps',    'Primește 5 tap-uri',          'Lasă-i pe alții să te observe',                       'taps_received',    5,  60,  NULL,         0, 'hand',           2),
  ('send_taps',       'Trimite 15 tap-uri',          'Arată cui îți place',                                  'taps_sent',       15,  50,  NULL,         0, 'hand',           3),
  ('view_profiles',   'Explorează 25 profiluri',     'Vezi cine e în zona ta',                              'profiles_viewed', 25,  40,  NULL,         0, 'compass',        4),
  ('match',           'Obține 2 match-uri',          'Reciprocitate pură',                                   'matches',          2,  120, 'boost',      1, 'heart',          5),
  ('post_story',      'Postează 3 story-uri',        'Arată-ți ziua',                                        'stories_posted',   3,  70,  NULL,         0, 'circle-plus',    6),
  ('complete_profile','Profil complet 100%',          'Adaugă bio, poze, prompts',                            'profile_complete', 100, 150, 'super_taps', 3, 'badge-check',    7),
  ('attend_event',    'RSVP la un eveniment',         'Conectează-te în viața reală',                         'events_rsvp',      1,  90,  NULL,         0, 'calendar',       8)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, target=EXCLUDED.target,
  xp_reward=EXCLUDED.xp_reward, bonus_kind=EXCLUDED.bonus_kind, bonus_amount=EXCLUDED.bonus_amount,
  icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order;

-- User quest progress (per week)
CREATE TABLE IF NOT EXISTS public.user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text NOT NULL REFERENCES public.quest_templates(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id, week_start)
);
CREATE INDEX IF NOT EXISTS user_quests_user_week_idx ON public.user_quests(user_id, week_start);

GRANT SELECT, INSERT, UPDATE ON public.user_quests TO authenticated;
GRANT ALL ON public.user_quests TO service_role;
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_quests_own_select ON public.user_quests FOR SELECT TO authenticated USING (user_id = auth.uid());
-- writes via SECURITY DEFINER functions only
CREATE POLICY user_quests_no_direct_write ON public.user_quests FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY user_quests_no_direct_update ON public.user_quests FOR UPDATE TO authenticated USING (false);

-- Helper: ISO week-start (Monday) in UTC
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS date
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'UTC'))::date;
$$;

-- Get my quests
CREATE OR REPLACE FUNCTION public.get_my_quests()
RETURNS TABLE(
  id text, title text, description text, metric text, target integer,
  xp_reward integer, bonus_kind text, bonus_amount integer, icon text,
  progress integer, completed boolean, claimed boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); wk date := public.current_week_start();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT t.id, t.title, t.description, t.metric, t.target,
           t.xp_reward, t.bonus_kind, t.bonus_amount, t.icon,
           COALESCE(uq.progress, 0)::integer AS progress,
           (uq.completed_at IS NOT NULL) AS completed,
           (uq.claimed_at IS NOT NULL) AS claimed
      FROM public.quest_templates t
      LEFT JOIN public.user_quests uq
        ON uq.quest_id = t.id AND uq.user_id = uid AND uq.week_start = wk
     ORDER BY t.sort_order;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_quests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_quests() TO authenticated;

-- Increment progress (called from triggers or RPCs)
CREATE OR REPLACE FUNCTION public.increment_quest_progress(_user_id uuid, _metric text, _delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE wk date := public.current_week_start(); t record;
BEGIN
  IF _user_id IS NULL OR _delta <= 0 THEN RETURN; END IF;
  FOR t IN SELECT id, target FROM public.quest_templates WHERE metric = _metric LOOP
    INSERT INTO public.user_quests(user_id, quest_id, week_start, progress)
      VALUES (_user_id, t.id, wk, LEAST(_delta, t.target))
      ON CONFLICT (user_id, quest_id, week_start) DO UPDATE
        SET progress = LEAST(public.user_quests.progress + _delta, t.target),
            completed_at = CASE WHEN public.user_quests.progress + _delta >= t.target
                                 AND public.user_quests.completed_at IS NULL
                                THEN now() ELSE public.user_quests.completed_at END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_quest_progress(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_quest_progress(uuid, text, integer) TO authenticated, service_role;

-- Claim quest reward
CREATE OR REPLACE FUNCTION public.claim_quest_reward(_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid(); wk date := public.current_week_start();
  uq record; tpl record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO uq FROM public.user_quests
   WHERE user_id = uid AND quest_id = _quest_id AND week_start = wk;
  IF NOT FOUND OR uq.completed_at IS NULL THEN RAISE EXCEPTION 'not_completed'; END IF;
  IF uq.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT * INTO tpl FROM public.quest_templates WHERE id = _quest_id;

  UPDATE public.user_quests SET claimed_at = now() WHERE id = uq.id;

  PERFORM public.award_xp(uid, 'quest:' || _quest_id, tpl.xp_reward, jsonb_build_object('quest', _quest_id));

  IF tpl.bonus_kind IS NOT NULL AND tpl.bonus_amount > 0 THEN
    UPDATE public.profiles
       SET boosts_balance = boosts_balance + CASE WHEN tpl.bonus_kind = 'boost' THEN tpl.bonus_amount ELSE 0 END,
           super_taps_balance = super_taps_balance + CASE WHEN tpl.bonus_kind = 'super_taps' THEN tpl.bonus_amount ELSE 0 END
     WHERE id = uid;
  END IF;

  RETURN jsonb_build_object('xp', tpl.xp_reward, 'bonus_kind', tpl.bonus_kind, 'bonus_amount', tpl.bonus_amount);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_quest_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_quest_reward(text) TO authenticated;

-- Auto-progress triggers
CREATE OR REPLACE FUNCTION public.tg_quest_message_sent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.increment_quest_progress(NEW.sender_id, 'messages_sent', 1); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.tg_quest_tap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.sender_id, 'taps_sent', 1);
  PERFORM public.increment_quest_progress(NEW.recipient_id, 'taps_received', 1);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_quest_profile_view() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.increment_quest_progress(NEW.viewer_id, 'profiles_viewed', 1); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.tg_quest_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.user_a, 'matches', 1);
  PERFORM public.increment_quest_progress(NEW.user_b, 'matches', 1);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_quest_story_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.increment_quest_progress(NEW.user_id, 'stories_posted', 1); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.tg_quest_event_rsvp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.increment_quest_progress(NEW.user_id, 'events_rsvp', 1); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS quest_message_sent ON public.messages;
CREATE TRIGGER quest_message_sent AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_message_sent();

DROP TRIGGER IF EXISTS quest_tap ON public.taps;
CREATE TRIGGER quest_tap AFTER INSERT ON public.taps
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_tap();

DROP TRIGGER IF EXISTS quest_profile_view ON public.profile_views;
CREATE TRIGGER quest_profile_view AFTER INSERT ON public.profile_views
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_profile_view();

DROP TRIGGER IF EXISTS quest_match ON public.matches;
CREATE TRIGGER quest_match AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_match();

DROP TRIGGER IF EXISTS quest_story_post ON public.stories;
CREATE TRIGGER quest_story_post AFTER INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_story_post();

DROP TRIGGER IF EXISTS quest_event_rsvp ON public.event_rsvps;
CREATE TRIGGER quest_event_rsvp AFTER INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_quest_event_rsvp();

-- Local leaderboard
CREATE OR REPLACE FUNCTION public.get_local_leaderboard(_radius_km integer DEFAULT 50)
RETURNS TABLE(
  user_id uuid, display_name text, photo_url text, level integer,
  weekly_xp integer, streak_days integer, rank integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_loc geography;
  wk date := public.current_week_start();
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT location INTO me_loc FROM public.profiles WHERE id = auth.uid();
  IF me_loc IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH weekly AS (
    SELECT xe.user_id, SUM(xe.xp)::int AS xp_sum
      FROM public.xp_events xe
     WHERE xe.created_at >= wk
     GROUP BY xe.user_id
  )
  SELECT p.id,
         p.display_name,
         (p.photos->0->>'path')::text AS photo_url,
         p.level,
         COALESCE(w.xp_sum, 0) AS weekly_xp,
         p.streak_days,
         (ROW_NUMBER() OVER (ORDER BY COALESCE(w.xp_sum, 0) DESC, p.level DESC))::int AS rank
    FROM public.profiles p
    LEFT JOIN weekly w ON w.user_id = p.id
   WHERE p.leaderboard_opt_in = true
     AND p.location IS NOT NULL
     AND ST_DWithin(p.location, me_loc, _radius_km * 1000)
     AND p.id <> auth.uid()
   ORDER BY weekly_xp DESC, p.level DESC
   LIMIT 20;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_local_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_local_leaderboard(integer) TO authenticated;
