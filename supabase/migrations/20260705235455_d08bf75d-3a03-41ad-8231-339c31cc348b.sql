
-- Modific triggerul append-only să permită DELETE (păstrează interdicția pe UPDATE)
CREATE OR REPLACE FUNCTION public.prevent_verification_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'verification_audit is append-only (updates forbidden)';
  END IF;
  -- DELETE permis pentru cascade la ștergerea de useri (GDPR right-to-erasure)
  RETURN COALESCE(NEW, OLD);
END;
$$;
