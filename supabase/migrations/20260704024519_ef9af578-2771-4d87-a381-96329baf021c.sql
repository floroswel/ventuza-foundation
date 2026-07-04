CREATE OR REPLACE FUNCTION public.trg_recompute_risk_on_fingerprint()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM public.recompute_user_risk(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    -- best-effort: nu blocăm register_device_fingerprint dacă recompute crapă
    NULL;
  END;
  RETURN NEW;
END $function$;