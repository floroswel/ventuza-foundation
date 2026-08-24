CREATE TABLE IF NOT EXISTS public.client_errors (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  stack text,
  path text,
  boundary text,
  app_version text,
  platform text,
  user_agent text
);

GRANT INSERT ON public.client_errors TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.client_errors_id_seq TO authenticated, anon;
GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_errors_insert_any ON public.client_errors;
CREATE POLICY client_errors_insert_any ON public.client_errors
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS client_errors_staff_read ON public.client_errors;
CREATE POLICY client_errors_staff_read ON public.client_errors
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.client_errors TO authenticated;

CREATE INDEX IF NOT EXISTS client_errors_created_idx ON public.client_errors (created_at DESC);