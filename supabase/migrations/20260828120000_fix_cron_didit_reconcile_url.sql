-- ============================================================================
-- Repară cron-ul de reconciliere Didit, care nu a rulat niciodată.
--
-- SIMPTOM: verificările de vârstă rămâneau blocate în stări intermediare;
-- reconcilierea programată la 15 minute nu avea niciun efect.
--
-- CAUZA (demonstrată cu cereri reale către producție):
--   POST https://ventuza-foundation.lovable.app/api/public/cron/didit-reconcile
--     → 307 Temporary Redirect către https://suzeta.app/...
--
-- Vechiul domeniu Lovable redirectează acum către domeniul propriu. Redirectul
-- e cross-host, iar la schimbarea de host header-ul `Authorization` este
-- eliminat (comportament standard curl/libcurl, ca un token să nu ajungă la o
-- gazdă necunoscută). Deci:
--   · dacă pg_net NU urmărește redirectul → cererea se oprește la 307;
--   · dacă îl urmărește                   → ajunge fără token → 401.
-- În ambele cazuri reconcilierea nu se execută. Confirmat:
--   POST suzeta.app/api/public/cron/didit-reconcile fără token → 401
--   POST prin redirect, cu Authorization                       → 401
--
-- REPARAȚIA: apel direct pe domeniul canonic, fără redirect, deci cu tokenul
-- intact. Restul funcției rămâne neschimbat.
--
-- VERIFICARE după aplicare (așteaptă un ciclu de 15 minute):
--   select status_code, created, url
--     from net._http_response order by created desc limit 10;
--   -- se așteaptă 200 pe suzeta.app, nu 307/401 pe lovable.app
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_didit_reconcile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT value->>'token' INTO v_token FROM public.app_settings WHERE key = 'cron_internal';
  IF v_token IS NULL THEN
    -- Fără token nu are rost să trimitem: endpoint-ul este fail-closed.
    RAISE WARNING '[cron_didit_reconcile] app_settings.cron_internal lipsește — reconcilierea nu rulează';
    RETURN;
  END IF;

  PERFORM net.http_post(
    -- Domeniul canonic, direct. Orice alt host introduce un redirect care
    -- pierde header-ul Authorization și transformă apelul într-un 401 tăcut.
    url := 'https://suzeta.app/api/public/cron/didit-reconcile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_didit_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_didit_reconcile() TO service_role;
