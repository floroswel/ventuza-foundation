
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hiv_status_enc bytea,
  ADD COLUMN IF NOT EXISTS hiv_test_date_enc bytea;

COMMENT ON COLUMN public.profiles.hiv_status_enc IS
  'GDPR Art. 9. Cifrat cu pgcrypto (pgp_sym_encrypt) folosind HEALTH_COL_KEY din secret server. Decriptare DOAR în RPC server-side (get_user_health), grant exclusiv pentru service_role. Protejează la nivel de dump/backup/acces parțial la DB (un atacator cu read pe profiles vede bytea opac). NU protejează împotriva compromiterii totale a infrastructurii — cheia trăiește în env-ul server-ului.';
COMMENT ON COLUMN public.profiles.hiv_test_date_enc IS
  'GDPR Art. 9. Cifrat cu pgcrypto, aceleași limitări ca hiv_status_enc.';

-- Drop triggerul vechi (care depinde de coloanele plaintext) ÎNAINTE de orice altceva
DROP TRIGGER IF EXISTS enforce_health_consent ON public.profiles;

-- Backfill: useri cu date HIV fără consimțământ — wipe
DO $$
DECLARE
  v_affected int;
BEGIN
  WITH wiped AS (
    UPDATE public.profiles p
       SET hiv_status = NULL,
           hiv_test_date = NULL,
           health_data_consent_at = NULL
     WHERE (p.hiv_status IS NOT NULL OR p.hiv_test_date IS NOT NULL)
       AND NOT public.has_active_health_consent(p.id)
    RETURNING p.id
  )
  SELECT count(*) INTO v_affected FROM wiped;

  INSERT INTO public.admin_audit_log (action, target_table, after_data, justification, severity)
  VALUES (
    'gdpr_health_backfill_wipe',
    'profiles',
    jsonb_build_object('rows_affected', v_affected, 'strategy', 'wipe_then_reconsent_on_next_edit', 'at', now()),
    'Art. 9 GDPR — date HIV scrise înainte de enforcement, fără consimțământ înregistrat în consent_log',
    'high'
  );
  RAISE NOTICE 'GDPR health backfill: wiped % rows', v_affected;
END $$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS hiv_status,
  DROP COLUMN IF EXISTS hiv_test_date;

CREATE OR REPLACE FUNCTION public.health_gated_columns()
RETURNS text[] LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ARRAY['hiv_status_enc', 'hiv_test_date_enc']::text[]
$$;

CREATE OR REPLACE FUNCTION public.enforce_health_consent_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_writing_health boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_writing_health := (NEW.hiv_status_enc IS NOT NULL) OR (NEW.hiv_test_date_enc IS NOT NULL);
  ELSE
    v_writing_health :=
      (NEW.hiv_status_enc    IS NOT NULL AND NEW.hiv_status_enc    IS DISTINCT FROM OLD.hiv_status_enc) OR
      (NEW.hiv_test_date_enc IS NOT NULL AND NEW.hiv_test_date_enc IS DISTINCT FROM OLD.hiv_test_date_enc);
  END IF;

  IF v_writing_health AND NOT public.has_active_health_consent(NEW.id) THEN
    RAISE EXCEPTION 'health_consent_required: nu se pot scrie date de sănătate fără consimțământ activ (kind=health_data în consent_log)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER enforce_health_consent
  BEFORE INSERT OR UPDATE OF hiv_status_enc, hiv_test_date_enc ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_health_consent_on_profile();

CREATE OR REPLACE FUNCTION public.cascade_health_consent_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'health_data' AND NEW.accepted = false THEN
    UPDATE public.profiles
       SET hiv_status_enc = NULL,
           hiv_test_date_enc = NULL,
           health_data_consent_at = NULL
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_health(_user_id uuid, _key text)
RETURNS TABLE(hiv_status text, hiv_test_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'bad_user'; END IF;
  IF _key IS NULL OR length(_key) < 16 THEN RAISE EXCEPTION 'bad_key'; END IF;
  RETURN QUERY
    SELECT
      CASE WHEN p.hiv_status_enc IS NULL THEN NULL
           ELSE extensions.pgp_sym_decrypt(p.hiv_status_enc, _key) END AS hiv_status,
      CASE WHEN p.hiv_test_date_enc IS NULL THEN NULL
           ELSE extensions.pgp_sym_decrypt(p.hiv_test_date_enc, _key)::date END AS hiv_test_date
      FROM public.profiles p
     WHERE p.id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.get_user_health(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_health(uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_health(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_user_health(_user_id uuid, _status text, _date date, _key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'bad_user'; END IF;
  IF _key IS NULL OR length(_key) < 16 THEN RAISE EXCEPTION 'bad_key'; END IF;
  UPDATE public.profiles
     SET hiv_status_enc = CASE WHEN _status IS NULL OR _status = '' THEN NULL
                                ELSE extensions.pgp_sym_encrypt(_status, _key) END,
         hiv_test_date_enc = CASE WHEN _date IS NULL THEN NULL
                                  ELSE extensions.pgp_sym_encrypt(_date::text, _key) END
   WHERE id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.set_user_health(uuid, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_health(uuid, text, date, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_user_health(uuid, text, date, text) TO service_role;
