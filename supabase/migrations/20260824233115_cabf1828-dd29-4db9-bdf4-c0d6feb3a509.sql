CREATE OR REPLACE FUNCTION public.consent_kinds()
RETURNS TABLE(kind text, current_version integer, required boolean, art9 boolean, description text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT * FROM (VALUES
    ('terms', 1, true, false, 'Termeni și condiții'),
    ('privacy', 1, true, false, 'Politica de confidențialitate'),
    ('age_verification', 3, true, true, 'Verificare vârstă (18+) prin Didit — procesator extern specializat. Estimare vârstă din selfie; imaginea este procesată de Didit și ștearsă imediat, primim doar rezultatul (trecut/respins). Temei: Art. 9(2)(a) GDPR — consimțământ explicit.'),
    ('ai_features', 1, false, false, 'Funcții AI (recomandări, moderare, traducere)'),
    ('push_notifications', 1, false, false, 'Notificări push'),
    ('background_location', 1, false, false, 'Locație în background pentru geofencing'),
    ('marketing', 1, false, false, 'Comunicări marketing'),
    ('partner_announcements', 1, false, false, 'Anunțuri de la parteneri Premium (evenimente, oferte). Opt-in explicit — implicit OPRIT. Poți retrage oricând din Setări.'),
    ('cookies_analytics', 1, false, false, 'Cookie-uri / stocare locală analitică — statistici agregate de utilizare (Art. 6(1)(a) GDPR, opt-in). Poți retrage oricând din bannerul de cookies sau din Setări.'),
    ('cookies_marketing', 1, false, false, 'Cookie-uri / stocare locală de marketing — măsurarea campaniilor și atribuirea instalărilor (Art. 6(1)(a) GDPR, opt-in). Poți retrage oricând din bannerul de cookies sau din Setări.')
  ) AS t(kind, current_version, required, art9, description);
$$;
