CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Se aplică DOAR scrierilor directe prin Data API (rolurile anon/authenticated).
  -- Funcțiile SECURITY DEFINER (XP, quests, moderare, Didit) rulează cu owner-ul
  -- funcției drept current_user și rămân neafectate.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;
  IF public.is_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  NEW.verified              := OLD.verified;
  NEW.verification_status   := OLD.verification_status;
  NEW.age_status            := OLD.age_status;
  NEW.age_verified_at       := OLD.age_verified_at;
  NEW.age_provider          := OLD.age_provider;
  NEW.xp                    := OLD.xp;
  NEW.level                 := OLD.level;
  NEW.boosts_balance        := OLD.boosts_balance;
  NEW.super_taps_balance    := OLD.super_taps_balance;
  NEW.risk_score            := OLD.risk_score;
  NEW.risk_signals          := OLD.risk_signals;
  NEW.report_count          := OLD.report_count;
  NEW.banned_at             := OLD.banned_at;
  NEW.banned_until          := OLD.banned_until;
  NEW.banned_reason         := OLD.banned_reason;
  NEW.suspended_until       := OLD.suspended_until;
  NEW.suspended_reason      := OLD.suspended_reason;
  NEW.warned_at             := OLD.warned_at;
  NEW.legal_hold            := OLD.legal_hold;
  NEW.legal_hold_reason     := OLD.legal_hold_reason;
  NEW.profile_completion    := OLD.profile_completion;
  NEW.partner_suspended_at  := OLD.partner_suspended_at;
  RETURN NEW;
END;
$function$;