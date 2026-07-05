
CREATE OR REPLACE FUNCTION public.prevent_verification_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Permitem exclusiv cascada FK: request_id devine NULL, restul rândului neschimbat.
    IF NEW.request_id IS NULL
       AND OLD.request_id IS NOT NULL
       AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id
       AND NEW.action IS NOT DISTINCT FROM OLD.action
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'verification_audit is append-only (updates forbidden)';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
