CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('access','erasure','rectification','portability','objection','restriction','other')),
  contact_email text NOT NULL,
  full_name text,
  details text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','need_info','resolved','rejected')),
  assigned_team text NOT NULL DEFAULT 'dpo',
  internal_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gdpr_requests TO authenticated;
GRANT ALL ON public.gdpr_requests TO service_role;

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdpr_requests_owner_select" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_owner_select" ON public.gdpr_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "gdpr_requests_staff_update" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_staff_update" ON public.gdpr_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_gdpr_request(
  _kind text,
  _contact_email text,
  _full_name text DEFAULT NULL,
  _details text DEFAULT NULL
) RETURNS TABLE(ticket_code text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_recent int;
  v_email text := lower(btrim(_contact_email));
BEGIN
  IF _kind IS NULL OR _kind NOT IN ('access','erasure','rectification','portability','objection','restriction','other') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF _details IS NOT NULL AND length(_details) > 4000 THEN
    RAISE EXCEPTION 'details_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.gdpr_requests g
  WHERE g.contact_email = v_email AND g.created_at > now() - interval '1 hour';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'gdpr_rate_limited' USING ERRCODE = '53400';
  END IF;

  v_code := 'GDPR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.gdpr_requests (ticket_code, kind, contact_email, full_name, details, user_id, assigned_team)
  VALUES (
    v_code,
    _kind,
    v_email,
    nullif(btrim(coalesce(_full_name, '')), ''),
    nullif(btrim(coalesce(_details, '')), ''),
    auth.uid(),
    CASE WHEN _kind = 'erasure' THEN 'dpo' ELSE 'dpo' END
  );

  RETURN QUERY SELECT v_code, now();
END;
$$;

REVOKE ALL ON FUNCTION public.submit_gdpr_request(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_gdpr_request(text, text, text, text) TO anon, authenticated, service_role;