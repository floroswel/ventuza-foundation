-- Refacere trigger anti-privilege-escalation pe public.profiles cu schema reală.
-- Bug anterior: referințe la coloane inexistente (is_premium, is_founder, ban_reason)
-- cauzau "record has no field" la primul UPDATE non-service_role.
-- Lista de câmpuri privilegiate corespunde EXACT coloanelor existente.

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

  -- VERIFICARE / AGE
  IF NEW.verified                  IS DISTINCT FROM OLD.verified                  THEN NEW.verified                  := OLD.verified;                  END IF;
  IF NEW.verified_at               IS DISTINCT FROM OLD.verified_at               THEN NEW.verified_at               := OLD.verified_at;               END IF;
  IF NEW.age_verified_at           IS DISTINCT FROM OLD.age_verified_at           THEN NEW.age_verified_at           := OLD.age_verified_at;           END IF;
  IF NEW.age_status                IS DISTINCT FROM OLD.age_status                THEN NEW.age_status                := OLD.age_status;                END IF;
  IF NEW.age_provider              IS DISTINCT FROM OLD.age_provider              THEN NEW.age_provider              := OLD.age_provider;              END IF;
  IF NEW.verification_status       IS DISTINCT FROM OLD.verification_status       THEN NEW.verification_status       := OLD.verification_status;       END IF;
  IF NEW.verification_reason       IS DISTINCT FROM OLD.verification_reason       THEN NEW.verification_reason       := OLD.verification_reason;       END IF;
  IF NEW.verification_selfie_path  IS DISTINCT FROM OLD.verification_selfie_path  THEN NEW.verification_selfie_path  := OLD.verification_selfie_path;  END IF;

  -- MODERARE / BAN / WARN — un user nu-și poate ridica singur sancțiunea
  IF NEW.banned_at                 IS DISTINCT FROM OLD.banned_at                 THEN NEW.banned_at                 := OLD.banned_at;                 END IF;
  IF NEW.banned_reason             IS DISTINCT FROM OLD.banned_reason             THEN NEW.banned_reason             := OLD.banned_reason;             END IF;
  IF NEW.suspended_until           IS DISTINCT FROM OLD.suspended_until           THEN NEW.suspended_until           := OLD.suspended_until;           END IF;
  IF NEW.suspended_reason          IS DISTINCT FROM OLD.suspended_reason          THEN NEW.suspended_reason          := OLD.suspended_reason;          END IF;
  IF NEW.warned_at                 IS DISTINCT FROM OLD.warned_at                 THEN NEW.warned_at                 := OLD.warned_at;                 END IF;
  IF NEW.warned_reason             IS DISTINCT FROM OLD.warned_reason             THEN NEW.warned_reason             := OLD.warned_reason;             END IF;
  IF NEW.report_count              IS DISTINCT FROM OLD.report_count              THEN NEW.report_count              := OLD.report_count;              END IF;

  -- RISC (scoring sistem)
  IF NEW.risk_score                IS DISTINCT FROM OLD.risk_score                THEN NEW.risk_score                := OLD.risk_score;                END IF;
  IF NEW.risk_signals              IS DISTINCT FROM OLD.risk_signals              THEN NEW.risk_signals              := OLD.risk_signals;              END IF;
  IF NEW.risk_updated_at           IS DISTINCT FROM OLD.risk_updated_at           THEN NEW.risk_updated_at           := OLD.risk_updated_at;           END IF;

  -- ECONOMIE VIRTUALĂ / BOOSTS / XP
  IF NEW.boost_until               IS DISTINCT FROM OLD.boost_until               THEN NEW.boost_until               := OLD.boost_until;               END IF;
  IF NEW.boosts_balance            IS DISTINCT FROM OLD.boosts_balance            THEN NEW.boosts_balance            := OLD.boosts_balance;            END IF;
  IF NEW.super_taps_balance        IS DISTINCT FROM OLD.super_taps_balance        THEN NEW.super_taps_balance        := OLD.super_taps_balance;        END IF;
  IF NEW.xp                        IS DISTINCT FROM OLD.xp                        THEN NEW.xp                        := OLD.xp;                        END IF;
  IF NEW.level                     IS DISTINCT FROM OLD.level                     THEN NEW.level                     := OLD.level;                     END IF;
  IF NEW.streak_days               IS DISTINCT FROM OLD.streak_days               THEN NEW.streak_days               := OLD.streak_days;               END IF;

  -- PARTENER (entitlement-uri partener gestionate de admin)
  IF NEW.partner_suspended_at      IS DISTINCT FROM OLD.partner_suspended_at      THEN NEW.partner_suspended_at      := OLD.partner_suspended_at;      END IF;
  IF NEW.partner_suspension_reason IS DISTINCT FROM OLD.partner_suspension_reason THEN NEW.partner_suspension_reason := OLD.partner_suspension_reason; END IF;

  -- CONSIMȚĂMINTE health (controlate de triggerul dedicat cascade)
  IF NEW.health_data_consent_at    IS DISTINCT FROM OLD.health_data_consent_at    THEN NEW.health_data_consent_at    := OLD.health_data_consent_at;    END IF;

  -- HIV (encrypted) — scrise DOAR prin RPC SECURITY DEFINER cu service_role
  IF NEW.hiv_status_enc            IS DISTINCT FROM OLD.hiv_status_enc            THEN NEW.hiv_status_enc            := OLD.hiv_status_enc;            END IF;
  IF NEW.hiv_test_date_enc         IS DISTINCT FROM OLD.hiv_test_date_enc         THEN NEW.hiv_test_date_enc         := OLD.hiv_test_date_enc;         END IF;

  -- IDENTITATE imuabilă
  IF NEW.id                        IS DISTINCT FROM OLD.id                        THEN NEW.id                        := OLD.id;                        END IF;
  IF NEW.created_at                IS DISTINCT FROM OLD.created_at                THEN NEW.created_at                := OLD.created_at;                END IF;
  IF NEW.profile_slug              IS DISTINCT FROM OLD.profile_slug              THEN NEW.profile_slug              := OLD.profile_slug;              END IF;
  IF NEW.deleted_at                IS DISTINCT FROM OLD.deleted_at                THEN NEW.deleted_at                := OLD.deleted_at;                END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();