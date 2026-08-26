CREATE TABLE IF NOT EXISTS public.account_flow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email_confirmation','didit')),
  stage text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_flow_events_user_created_idx
  ON public.account_flow_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_flow_events_kind_created_idx
  ON public.account_flow_events (kind, created_at DESC);

GRANT SELECT ON public.account_flow_events TO authenticated;
GRANT ALL ON public.account_flow_events TO service_role;

ALTER TABLE public.account_flow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own account flow events" ON public.account_flow_events;
CREATE POLICY "own account flow events"
  ON public.account_flow_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff read account flow events" ON public.account_flow_events;
CREATE POLICY "staff read account flow events"
  ON public.account_flow_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_account_flow_event(
  _kind text,
  _stage text,
  _detail jsonb DEFAULT '{}'::jsonb,
  _user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
  new_id uuid;
BEGIN
  IF _kind NOT IN ('email_confirmation','didit') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  -- Un client autentificat poate loga DOAR pentru el însuși.
  IF auth.uid() IS NOT NULL THEN
    target := auth.uid();
  ELSE
    target := _user_id;
  END IF;

  IF target IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  INSERT INTO public.account_flow_events (user_id, kind, stage, detail)
  VALUES (target, _kind, left(_stage, 64), coalesce(_detail, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_account_flow_event(text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_account_flow_event(text, text, jsonb, uuid) TO authenticated, service_role;