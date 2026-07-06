-- Aliniere registru consimțăminte la realitatea Didit-only (iulie 2026).
-- Fluxul intern (liveness + moderator) este dezactivat; verificarea vârstei
-- se face exclusiv prin Didit (procesator extern UE, age estimation, imagine
-- tranzitorie ștearsă imediat, pass/fail returnat).
CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE(kind text, current_version integer, required boolean, art9 boolean, description text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('terms', 1, true, false, 'Termeni și condiții'),
    ('privacy', 1, true, false, 'Politica de confidențialitate'),
    ('age_verification', 3, true, true, 'Verificare vârstă (18+) prin Didit — procesator extern specializat. Estimare vârstă din selfie; imaginea este procesată de Didit și ștearsă imediat, primim doar rezultatul (trecut/respins). Temei: Art. 9(2)(a) GDPR — consimțământ explicit.'),
    ('ai_features', 1, false, false, 'Funcții AI (recomandări, moderare, traducere)'),
    ('push_notifications', 1, false, false, 'Notificări push'),
    ('background_location', 1, false, false, 'Locație în background pentru geofencing'),
    ('marketing', 1, false, false, 'Comunicări marketing'),
    ('partner_announcements', 1, false, false, 'Anunțuri de la parteneri Premium (evenimente, oferte). Opt-in explicit — implicit OPRIT. Poți retrage oricând din Setări.')
  ) AS t(kind, current_version, required, art9, description);
$function$;

COMMENT ON FUNCTION public.consent_kinds() IS
  'Registru autoritativ consimțăminte. Kind-ul internal_verification a fost retras în iulie 2026 (verificare vârstă = Didit exclusiv). Intrările istorice din consent_log rămân intacte pentru audit.';
