-- Blochează escaladarea de privilegii prin update direct pe public.profiles.
-- Userul poate modifica DOAR câmpurile non-privilegiate. Restul rămân exclusiv
-- pentru service_role (admin RPC / triggere / sistem).
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                       OR (current_user IN ('service_role','postgres','supabase_admin'));
BEGIN
  IF is_service THEN
    RETURN NEW;
  END IF;

  -- Câmpuri privilegiate: verificare, ban, suspendare, scoring, economie virtuală,
  -- progres, roluri partener/founder, plan, statusuri health gated by alte triggere.
  IF NEW.verified              IS DISTINCT FROM OLD.verified              THEN NEW.verified              := OLD.verified;              END IF;
  IF NEW.age_status            IS DISTINCT FROM OLD.age_status            THEN NEW.age_status            := OLD.age_status;            END IF;
  IF NEW.verification_status   IS DISTINCT FROM OLD.verification_status   THEN NEW.verification_status   := OLD.verification_status;   END IF;
  IF NEW.banned_at             IS DISTINCT FROM OLD.banned_at             THEN NEW.banned_at             := OLD.banned_at;             END IF;
  IF NEW.ban_reason            IS DISTINCT FROM OLD.ban_reason            THEN NEW.ban_reason            := OLD.ban_reason;            END IF;
  IF NEW.suspended_until       IS DISTINCT FROM OLD.suspended_until       THEN NEW.suspended_until       := OLD.suspended_until;       END IF;
  IF NEW.risk_score            IS DISTINCT FROM OLD.risk_score            THEN NEW.risk_score            := OLD.risk_score;            END IF;
  IF NEW.boosts_balance        IS DISTINCT FROM OLD.boosts_balance        THEN NEW.boosts_balance        := OLD.boosts_balance;        END IF;
  IF NEW.super_taps_balance    IS DISTINCT FROM OLD.super_taps_balance    THEN NEW.super_taps_balance    := OLD.super_taps_balance;    END IF;
  IF NEW.xp                    IS DISTINCT FROM OLD.xp                    THEN NEW.xp                    := OLD.xp;                    END IF;
  IF NEW.level                 IS DISTINCT FROM OLD.level                 THEN NEW.level                 := OLD.level;                 END IF;
  IF NEW.is_premium            IS DISTINCT FROM OLD.is_premium            THEN NEW.is_premium            := OLD.is_premium;            END IF;
  IF NEW.is_founder            IS DISTINCT FROM OLD.is_founder            THEN NEW.is_founder            := OLD.is_founder;            END IF;
  IF NEW.partner_suspended_at  IS DISTINCT FROM OLD.partner_suspended_at  THEN NEW.partner_suspended_at  := OLD.partner_suspended_at;  END IF;
  IF NEW.partner_suspension_reason IS DISTINCT FROM OLD.partner_suspension_reason THEN NEW.partner_suspension_reason := OLD.partner_suspension_reason; END IF;
  IF NEW.health_data_consent_at IS DISTINCT FROM OLD.health_data_consent_at THEN NEW.health_data_consent_at := OLD.health_data_consent_at; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();