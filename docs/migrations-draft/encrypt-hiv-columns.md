# Migrație draft — NU APLICATĂ

Criptare la nivel de coloană pentru date sensibile de sănătate (`hiv_status`, `hiv_test_date`) folosind `pgcrypto` simetric (`pgp_sym_encrypt` / `pgp_sym_decrypt`).

## Trade-off (important să decizi înainte să aplici)

- **Plus:** valorile clare nu mai apar nici în backup-uri, nici în dump-uri SQL, nici dacă cineva citește direct tabela din afara aplicației. Chiar și `service_role` vede doar bytea cifrate fără cheie.
- **Minus:** cheia trăieşte în PostgreSQL (GUC `app.health_key`) — dacă atacatorul are acces la cluster cu rol de superuser, are și cheia. Nu este "envelope encryption" cu KMS extern. Câștigul real e împotriva: leak de dump, dev care citește prod ad-hoc, backup furat, request log cu query plaintext.
- **Operațional:** indexare directă pe `hiv_status` nu mai funcționează. Filtrul `hiv_filter` din `discover_profiles` trebuie să decripteze în RPC (SECURITY DEFINER, set local app.health_key), ceea ce face filtrarea mai lentă pe N rows. Pentru baza actuală e ok; la 1M+ profile devine problemă.
- **Ireversibil fără cheie:** dacă pierzi `app.health_key`, datele sunt pierdute. Cheia trebuie ținută într-un secret extern (Lovable Secrets `HEALTH_COL_KEY`) și încărcată la nivel de sesiune sau de funcție, nu hardcodată în DB.

## Migrația propusă (de aplicat doar la confirmarea ta)

```sql
-- 1. Extensia
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Coloane criptate (alături de cele vechi, pentru backfill controlat)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hiv_status_enc bytea,
  ADD COLUMN IF NOT EXISTS hiv_test_date_enc bytea;

-- 3. Helper care citește cheia din GUC de sesiune (setată de aplicație
--    sau de un security-definer wrapper care o ia din vault/secrets).
CREATE OR REPLACE FUNCTION public._health_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_setting('app.health_key', true)
$$;

-- 4. Backfill (rulat o singură dată, în tranzacție separată)
--    SET LOCAL app.health_key = '<cheia-din-Lovable-Secrets>';
--    UPDATE public.profiles
--       SET hiv_status_enc = CASE WHEN hiv_status IS NULL THEN NULL
--             ELSE pgp_sym_encrypt(hiv_status, public._health_key()) END,
--           hiv_test_date_enc = CASE WHEN hiv_test_date IS NULL THEN NULL
--             ELSE pgp_sym_encrypt(hiv_test_date::text, public._health_key()) END;

-- 5. RPC singura cale de citire (doar pentru owner, NICIODATĂ pentru alți useri)
CREATE OR REPLACE FUNCTION public.get_my_health()
RETURNS TABLE(hiv_status text, hiv_test_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  RETURN QUERY
    SELECT pgp_sym_decrypt(p.hiv_status_enc, public._health_key())::text,
           pgp_sym_decrypt(p.hiv_test_date_enc, public._health_key())::date
      FROM public.profiles p
     WHERE p.id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_health() TO authenticated;

-- 6. Update via RPC, nu via UPDATE direct pe coloana plaintext
CREATE OR REPLACE FUNCTION public.set_my_health(_status text, _date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  UPDATE public.profiles
     SET hiv_status_enc = CASE WHEN _status IS NULL THEN NULL ELSE pgp_sym_encrypt(_status, public._health_key()) END,
         hiv_test_date_enc = CASE WHEN _date IS NULL THEN NULL ELSE pgp_sym_encrypt(_date::text, public._health_key()) END
   WHERE id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.set_my_health(text, date) TO authenticated;

-- 7. După ce frontend-ul citește/scrie doar prin RPC-uri, drop la plaintext:
-- ALTER TABLE public.profiles DROP COLUMN hiv_status;
-- ALTER TABLE public.profiles DROP COLUMN hiv_test_date;

-- 8. Filtrul HIV în discover_profiles trebuie regândit: ori păstrăm un câmp
--    "low-cardinality" hashat (HMAC pe valoare canonică) pentru egalitate
--    deterministă, ori scoatem cu totul filtrul de listă și permitem doar
--    afișarea pe profilul propriu.
```

## Pași operaționali

1. Adaugă secret `HEALTH_COL_KEY` (32+ chars random) în Lovable Secrets.
2. Aplicăm migrația de mai sus.
3. Backfill manual cu `SET LOCAL app.health_key = '<HEALTH_COL_KEY>'` într-o tranzacție.
4. Schimbăm frontend-ul (`src/routes/profile.tsx`, `src/routes/n.tsx`) să folosească `get_my_health` / `set_my_health` în loc de `select`/`update` pe `profiles`.
5. Înlocuim filtrul `hiv_filter` în `discover_profiles` (sau îl scoatem).
6. Drop coloane plaintext.

**Aşteaptă confirmarea ta înainte de a aplica.**
