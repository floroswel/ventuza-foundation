
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tz_offset_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT
    '{"matches":true,"messages":true,"likes":true,"events":true,"marketing":false,"master_push":true,"quiet_enabled":false,"quiet_start":23,"quiet_end":7}'::jsonb;

UPDATE public.profiles
SET notification_prefs = notification_prefs
  || jsonb_build_object(
       'master_push',   COALESCE(notification_prefs->'master_push',   to_jsonb(true)),
       'quiet_enabled', COALESCE(notification_prefs->'quiet_enabled', to_jsonb(false)),
       'quiet_start',   COALESCE(notification_prefs->'quiet_start',   to_jsonb(23)),
       'quiet_end',     COALESCE(notification_prefs->'quiet_end',     to_jsonb(7))
     )
WHERE notification_prefs IS NOT NULL;
