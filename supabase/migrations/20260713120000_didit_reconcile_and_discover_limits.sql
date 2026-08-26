-- 1) Config Discover (valori implicite = plafoanele istorice)
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'discover_limits',
  '{"max_per_call": 50, "max_calls_per_hour": 60}'::jsonb,
  'limits',
  'Plafoane discover_profiles. max_per_call este hard-capped la 50 și max_calls_per_hour la 60 în RPC; valorile de aici pot doar micșora limitele.'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Token intern cron (generat aleatoriu, citit doar server-side)
INSERT INTO public.app_settings (key, value, category, description)
VALUES (
  'cron_internal',
  jsonb_build_object('token', gen_random_uuid()::text),
  'internal',
  'Token bearer pentru endpointurile /api/public/cron/*. Nu se editează din UI.'
)
ON CONFLICT (key) DO NOTHING;

-- 3) discover_profiles cu limite citite din app_settings (doar micșorare).
-- Plafoanele absolute rămân constante în funcție: 50 profiluri/cerere, 60 cereri/oră
-- (regula permanentă RATE LIMIT DISCOVER). Definiția completă a funcției este cea
-- aplicată prin tool-ul de migrare la 2026-07-13 (CREATE OR REPLACE, semnătură neschimbată).

-- 4) security_invariants_snapshot actualizat — validează config-ul discover_limits
-- și prezența plafoanelor absolute (service_role only).

-- 5) cron_didit_reconcile() — SECURITY DEFINER, REVOKE PUBLIC/anon/authenticated,
-- GRANT EXECUTE doar service_role. Apelează prin pg_net:
--   POST https://ventuza-foundation.lovable.app/api/public/cron/didit-reconcile
--   Authorization: Bearer <app_settings.cron_internal.token>

-- 6) pg_cron: job 'didit-reconcile' la fiecare 15 minute (schedule id 181), idempotent
-- prin DO block cu verificare cron.job înainte de unschedule.
