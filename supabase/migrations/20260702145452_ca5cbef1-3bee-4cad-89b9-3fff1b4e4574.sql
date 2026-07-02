
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.compute_profile_completion(p profiles)
RETURNS smallint
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  s int := 0;
BEGIN
  IF p.display_name IS NOT NULL AND length(trim(p.display_name)) > 0 THEN s := s + 10; END IF;
  IF p.bio IS NOT NULL AND length(trim(p.bio)) >= 20 THEN s := s + 10; END IF;
  IF p.birthdate IS NOT NULL THEN s := s + 5; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 1 THEN s := s + 15; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos,1) >= 3 THEN s := s + 10; END IF;
  IF p.gender IS NOT NULL AND array_length(p.gender,1) > 0 THEN s := s + 5; END IF;
  IF p.orientation IS NOT NULL AND array_length(p.orientation,1) > 0 THEN s := s + 5; END IF;
  IF p.tribes IS NOT NULL AND array_length(p.tribes,1) > 0 THEN s := s + 5; END IF;
  IF p.looking_for IS NOT NULL AND array_length(p.looking_for,1) > 0 THEN s := s + 5; END IF;
  IF p.interests IS NOT NULL AND array_length(p.interests,1) > 0 THEN s := s + 5; END IF;
  IF p.height_cm IS NOT NULL THEN s := s + 3; END IF;
  IF p.weight_kg IS NOT NULL THEN s := s + 3; END IF;
  IF p.body_type IS NOT NULL THEN s := s + 3; END IF;
  IF p.position IS NOT NULL THEN s := s + 3; END IF;
  IF p.verified IS TRUE THEN s := s + 10; END IF;
  RETURN LEAST(s, 100)::smallint;
END
$function$;
