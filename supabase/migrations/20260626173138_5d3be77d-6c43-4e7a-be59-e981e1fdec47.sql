-- Wave 1 admin: orientation (Art. 9 — viața sexuală) tratat ca break-glass.
-- Câmpurile profiles.orientation / gender / gender_custom / pronouns /
-- pronouns_custom / tribes pot dezvălui orientarea pe o app queer și se
-- accesează DOAR prin adminBreakGlassReveal kind='orientation' (super_admin).
CREATE OR REPLACE FUNCTION public.admin_can_access_sensitive(_user_id uuid, _kind text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(_kind)
    WHEN 'health'      THEN public.has_role(_user_id, 'super_admin')
    WHEN 'orientation' THEN public.has_role(_user_id, 'super_admin')
    WHEN 'location'    THEN public.has_role(_user_id, 'super_admin')
    WHEN 'selfie'      THEN public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
    WHEN 'messages'    THEN public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
    ELSE false
  END
$function$;