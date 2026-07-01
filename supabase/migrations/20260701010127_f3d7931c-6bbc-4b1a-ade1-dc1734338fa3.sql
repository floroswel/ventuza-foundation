-- OPERAȚIUNEA 1 — Eliminare completă HIV + OPERAȚIUNEA 2 — Wipe seed content.

-- ============ OPERAȚIUNEA 1: ELIMINARE HIV ============

-- 1. Drop triggere HIV
DROP TRIGGER IF EXISTS enforce_health_consent ON public.profiles;
DROP TRIGGER IF EXISTS cascade_health_consent_withdrawal ON public.consent_log;

-- 2. Drop funcții HIV / health
DROP FUNCTION IF EXISTS public.get_user_health(uuid, text);
DROP FUNCTION IF EXISTS public.set_user_health(uuid, text, date, text);
DROP FUNCTION IF EXISTS public.enforce_health_consent_on_profile();
DROP FUNCTION IF EXISTS public.cascade_health_consent_withdrawal();
DROP FUNCTION IF EXISTS public.withdraw_health_consent(text);
DROP FUNCTION IF EXISTS public.has_active_health_consent(uuid);
DROP FUNCTION IF EXISTS public.health_gated_columns();
DROP FUNCTION IF EXISTS public.assert_no_plaintext_hiv_profile_completion();

-- 3. Drop coloane HIV din profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS hiv_status_enc,
  DROP COLUMN IF EXISTS hiv_test_date_enc,
  DROP COLUMN IF EXISTS health_data_consent_at;

-- 4. Actualizare consent_kinds — elimină 'health_data'
CREATE OR REPLACE FUNCTION public.consent_kinds()
 RETURNS TABLE(kind text, current_version text, required boolean, art9 boolean, description text)
 LANGUAGE sql IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('terms',                '2026-06-22', true,  false, 'Termeni și condiții.'),
    ('privacy',              '2026-06-22', true,  false, 'Politică de confidențialitate.'),
    ('age_verification',     '2026-06-26', false, true,  'Imagine biometrică (selfie) trimisă către Didit pentru estimarea vârstei. Art. 9.'),
    ('ai_features',          '2026-06-26', false, false, 'Text de profil / chat procesat de modele AI externe (Lovable AI Gateway).'),
    ('push_notifications',   '2026-06-26', false, false, 'Abonament push web pentru notificări (mesaje, match-uri, evenimente).'),
    ('background_location',  '2026-06-26', false, false, 'Acces locație în fundal pentru geofencing (notificări când treci pe lângă un eveniment/local cu app-ul închis).'),
    ('marketing',            '2026-06-22', false, false, 'Comunicări de marketing (newsletter, oferte).')
  ) AS t(kind, current_version, required, art9, description)
$function$;

-- Notă: intrările istorice din `consent_log` cu kind='health_data' rămân
-- pentru probă (Art. 7(1) GDPR). Nu mai pot fi create noi — RPC record_consent
-- validează kind împotriva consent_kinds().

-- ============ OPERAȚIUNEA 2: WIPE SEED (is_seed=true) ============
-- Verificat: în momentul migrării toate contorii sunt 0. DELETE-urile de mai
-- jos sunt defensive (dacă apar rânduri între verificare și apply).

DELETE FROM public.partner_boost_orders WHERE is_seed = true;
DELETE FROM public.partner_invoices WHERE is_seed = true;
DELETE FROM public.subscriptions WHERE is_seed = true;
DELETE FROM public.partner_subscriptions WHERE is_seed = true;
DELETE FROM public.ad_campaigns WHERE is_seed = true;
DELETE FROM public.advertisers WHERE is_seed = true;
DELETE FROM public.offers WHERE is_seed = true;
DELETE FROM public.events WHERE is_seed = true;
DELETE FROM public.venues WHERE is_seed = true;
DELETE FROM public.business_applications WHERE is_seed = true;
DELETE FROM public.deletion_requests WHERE is_seed = true;
DELETE FROM public.reports WHERE is_seed = true;
DELETE FROM public.risk_flags WHERE is_seed = true;
DELETE FROM public.illegal_content_reports WHERE is_seed = true;
DELETE FROM public.csam_reports WHERE is_seed = true;
DELETE FROM public.breach_incidents WHERE is_seed = true;
DELETE FROM public.admin_alerts WHERE is_seed = true;
DELETE FROM public.policy_versions WHERE is_seed = true;
DELETE FROM public.profiles WHERE is_seed = true;