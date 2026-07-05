
CREATE OR REPLACE FUNCTION public.prevent_verification_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.request_id IS NULL
       AND OLD.request_id IS NOT NULL
       AND NEW.id           IS NOT DISTINCT FROM OLD.id
       AND NEW.user_id      IS NOT DISTINCT FROM OLD.user_id
       AND NEW.moderator_id IS NOT DISTINCT FROM OLD.moderator_id
       AND NEW.action       IS NOT DISTINCT FROM OLD.action
       AND NEW.decision     IS NOT DISTINCT FROM OLD.decision
       AND NEW.created_at   IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'verification_audit is append-only (updates forbidden)';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
