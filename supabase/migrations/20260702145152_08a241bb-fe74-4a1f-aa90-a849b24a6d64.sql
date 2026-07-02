
-- Capturăm IP + user_agent la fiecare consimțământ pentru trasabilitate GDPR.
CREATE OR REPLACE FUNCTION public.record_consent(
  _kind text,
  _version text DEFAULT NULL::text,
  _accepted boolean DEFAULT true,
  _user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_known   boolean;
  v_current text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT TRUE, current_version
    INTO v_known, v_current
    FROM public.consent_kinds()
   WHERE kind = _kind;

  IF v_known IS NULL THEN
    RAISE EXCEPTION 'unknown_consent_kind: %', _kind
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.consent_log (user_id, kind, version, accepted, ip, user_agent)
  VALUES (
    auth.uid(),
    _kind,
    COALESCE(_version, v_current),
    COALESCE(_accepted, true),
    inet_client_addr(),
    NULLIF(_user_agent, '')
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.record_consent(text, text, boolean, text) TO authenticated;
