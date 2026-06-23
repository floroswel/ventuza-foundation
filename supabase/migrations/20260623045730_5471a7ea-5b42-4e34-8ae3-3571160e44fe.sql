
-- 1. Add gamification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_check_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS boosts_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_taps_balance integer NOT NULL DEFAULT 3;

-- 2. XP event log
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  xp integer NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_events_user_created_idx ON public.xp_events(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY xp_events_own_select ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY xp_events_own_insert ON public.xp_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 3. Daily reward log
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  streak_day integer NOT NULL,
  reward_kind text NOT NULL,
  reward_amount integer NOT NULL,
  xp_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claimed_on)
);
GRANT SELECT ON public.daily_rewards TO authenticated;
GRANT ALL ON public.daily_rewards TO service_role;
ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_rewards_own_select ON public.daily_rewards FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. Award XP (internal helper)
CREATE OR REPLACE FUNCTION public.award_xp(_user_id uuid, _kind text, _xp integer, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_xp integer;
  new_level integer;
BEGIN
  IF _xp <= 0 THEN RETURN; END IF;

  INSERT INTO public.xp_events(user_id, kind, xp, meta) VALUES (_user_id, _kind, _xp, _meta);

  UPDATE public.profiles
     SET xp = xp + _xp
   WHERE id = _user_id
   RETURNING xp INTO new_xp;

  -- Level curve: level n requires 100 * n * (n+1) / 2 XP cumulative (1->100, 2->300, 3->600, 4->1000)
  new_level := GREATEST(1, FLOOR((-1 + SQRT(1 + 8 * new_xp / 100.0)) / 2)::int + 1);
  UPDATE public.profiles SET level = new_level WHERE id = _user_id AND level <> new_level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, jsonb) TO authenticated, service_role;

-- 5. Claim daily reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  last_date date;
  today date := (now() AT TIME ZONE 'UTC')::date;
  cur_streak integer;
  next_streak integer;
  reward_kind text;
  reward_amount integer;
  xp_reward integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Already claimed today?
  IF EXISTS (SELECT 1 FROM public.daily_rewards WHERE user_id = uid AND claimed_on = today) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  SELECT (last_check_in_at AT TIME ZONE 'UTC')::date, streak_days
    INTO last_date, cur_streak
    FROM public.profiles WHERE id = uid;

  cur_streak := COALESCE(cur_streak, 0);

  IF last_date IS NULL OR last_date < today - INTERVAL '1 day' THEN
    next_streak := 1;
  ELSIF last_date = today - INTERVAL '1 day' THEN
    next_streak := cur_streak + 1;
  ELSE
    next_streak := GREATEST(cur_streak, 1);
  END IF;

  -- Reward table by streak day (cycles every 7)
  CASE ((next_streak - 1) % 7) + 1
    WHEN 1 THEN reward_kind := 'super_taps'; reward_amount := 1; xp_reward := 20;
    WHEN 2 THEN reward_kind := 'xp';         reward_amount := 0; xp_reward := 40;
    WHEN 3 THEN reward_kind := 'super_taps'; reward_amount := 2; xp_reward := 30;
    WHEN 4 THEN reward_kind := 'xp';         reward_amount := 0; xp_reward := 60;
    WHEN 5 THEN reward_kind := 'boost';      reward_amount := 1; xp_reward := 50;
    WHEN 6 THEN reward_kind := 'super_taps'; reward_amount := 3; xp_reward := 70;
    WHEN 7 THEN reward_kind := 'boost';      reward_amount := 2; xp_reward := 150; -- big weekly reward
  END CASE;

  INSERT INTO public.daily_rewards(user_id, claimed_on, streak_day, reward_kind, reward_amount, xp_awarded)
    VALUES (uid, today, next_streak, reward_kind, reward_amount, xp_reward);

  UPDATE public.profiles
     SET streak_days = next_streak,
         last_check_in_at = now(),
         boosts_balance = boosts_balance + CASE WHEN reward_kind = 'boost' THEN reward_amount ELSE 0 END,
         super_taps_balance = super_taps_balance + CASE WHEN reward_kind = 'super_taps' THEN reward_amount ELSE 0 END
   WHERE id = uid;

  PERFORM public.award_xp(uid, 'daily_checkin', xp_reward, jsonb_build_object('streak', next_streak));

  RETURN jsonb_build_object(
    'streak', next_streak,
    'reward_kind', reward_kind,
    'reward_amount', reward_amount,
    'xp', xp_reward
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;

-- 6. Read gamification state
CREATE OR REPLACE FUNCTION public.get_my_gamification()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p record;
  today date := (now() AT TIME ZONE 'UTC')::date;
  claimed_today boolean;
  next_level_xp integer;
  cur_level_xp integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT xp, level, streak_days, last_check_in_at, boosts_balance, super_taps_balance
    INTO p FROM public.profiles WHERE id = uid;

  claimed_today := EXISTS (SELECT 1 FROM public.daily_rewards WHERE user_id = uid AND claimed_on = today);

  cur_level_xp  := 100 * (p.level - 1) * p.level / 2;
  next_level_xp := 100 * p.level * (p.level + 1) / 2;

  RETURN jsonb_build_object(
    'xp', p.xp,
    'level', p.level,
    'level_xp_start', cur_level_xp,
    'level_xp_end', next_level_xp,
    'streak_days', p.streak_days,
    'last_check_in_at', p.last_check_in_at,
    'boosts_balance', p.boosts_balance,
    'super_taps_balance', p.super_taps_balance,
    'claimed_today', claimed_today
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_gamification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_gamification() TO authenticated;
