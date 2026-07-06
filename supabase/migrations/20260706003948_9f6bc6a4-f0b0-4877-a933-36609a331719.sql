-- Fix 1: allow nested trigger writes to risk_score/risk_signals/risk_updated_at
-- (recompute_risk_score is SECURITY DEFINER, called from an AFTER trigger on location).
CREATE OR REPLACE FUNCTION public.prevent_risk_score_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow updates coming from a nested trigger chain (e.g. recompute_risk_score
  -- invoked by trg_loc_risk_after). Direct client updates run at depth 1.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF (NEW.risk_score IS DISTINCT FROM OLD.risk_score
      OR NEW.risk_signals IS DISTINCT FROM OLD.risk_signals
      OR NEW.risk_updated_at IS DISTINCT FROM OLD.risk_updated_at)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_any_role(auth.uid(),
           ARRAY['admin','super_admin','moderator']::app_role[]) THEN
    RAISE EXCEPTION 'risk_score_write_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

-- Fix 2: use array_append (unambiguous) instead of ||, which can be resolved
-- as array-literal cast at runtime and raise "malformed array literal".
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  badges text[] := ARRAY[]::text[];
  v_age_status text;
  v_created_at timestamptz;
  v_matches int;
  v_streak int;
  v_cities int;
BEGIN
  SELECT age_status, created_at INTO v_age_status, v_created_at
  FROM public.profiles WHERE id = _user_id;

  IF v_age_status = 'verified' THEN
    badges := array_append(badges, 'verified');
  END IF;

  IF v_created_at IS NOT NULL AND v_created_at < '2026-08-01'::timestamptz THEN
    badges := array_append(badges, 'founder');
  END IF;

  SELECT count(*) INTO v_matches
  FROM public.matches
  WHERE user_a = _user_id OR user_b = _user_id;
  IF v_matches >= 25 THEN
    badges := array_append(badges, 'matcher');
  END IF;

  SELECT count(*) INTO v_streak FROM (
    SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS d
    FROM public.xp_events
    WHERE user_id = _user_id
      AND created_at >= now() - interval '10 days'
    ORDER BY d DESC
    LIMIT 7
  ) t;
  IF v_streak >= 7 THEN
    badges := array_append(badges, 'streak_7');
  END IF;

  SELECT count(DISTINCT lower(city)) INTO v_cities
  FROM public.xp_events e
  LEFT JOIN public.venues v ON v.id = (e.meta->>'venue_id')::uuid
  WHERE e.user_id = _user_id AND v.city IS NOT NULL;
  IF v_cities >= 5 THEN
    badges := array_append(badges, 'explorer');
  END IF;

  RETURN badges;
END;
$function$;