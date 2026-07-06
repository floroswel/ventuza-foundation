-- Purge finală HIV / date de sănătate din DB.
--
-- Context: coloanele hiv_status* și funcțiile get/set_user_health au fost deja
-- eliminate. Această migrare mai curăță:
--   1. `health_data` din registrul `public.consent_kinds()` — nu mai poate fi
--      înregistrat un consimțământ nou pentru date de sănătate.
--   2. DROP defensiv pe overload-urile legacy ale `discover_profiles` care
--      returnau `hiv_status` / `hiv_test_date` (deja șterse în producție —
--      IF EXISTS le păstrează idempotente).
--
-- Intrările istorice din `consent_log` cu kind='health_data' RĂMÂN (append-only,
-- audit trail GDPR).

-- 1) Consent registry fără health_data.
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE(kind text, current_version integer, required boolean, art9 boolean, description text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('terms', 1, true, false, 'Termeni și condiții'),
    ('privacy', 1, true, false, 'Politica de confidențialitate'),
    ('age_verification', 2, true, true, 'Procesare imagini pentru verificare vârstă (proces intern, fără terți)'),
    ('internal_verification', 1, true, true, 'Verificare identitate internă prin selfie-uri liveness — review manual de moderator'),
    ('ai_features', 1, false, false, 'Funcții AI (recomandări, moderare, traducere)'),
    ('push_notifications', 1, false, false, 'Notificări push'),
    ('background_location', 1, false, false, 'Locație în background pentru geofencing'),
    ('marketing', 1, false, false, 'Comunicări marketing'),
    ('partner_announcements', 1, false, false, 'Anunțuri de la parteneri Premium (evenimente, oferte). Opt-in explicit — implicit OPRIT. Poți retrage oricând din Setări.')
  ) AS t(kind, current_version, required, art9, description);
$function$;

-- 2) DROP defensiv pentru orice overload legacy discover_profiles care
--    proiecta câmpuri HIV. Semnăturile de mai jos apar în istoricul de migrări.
DROP FUNCTION IF EXISTS public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer
);
DROP FUNCTION IF EXISTS public.discover_profiles(
  integer, integer, integer, text[], text[], text[], text[], text[], text[], text[],
  integer, integer, boolean, boolean, boolean, text, integer, boolean
);
DROP FUNCTION IF EXISTS public.discover_profiles(
  uuid, integer, integer, integer, text[], text[], text[], integer, integer, boolean, text, text
);
-- Nu atinge overload-ul funcțional (semnătura cu 19 parametri _viewer uuid,
-- ..., _verified_only boolean) — el nu returnează date HIV.
