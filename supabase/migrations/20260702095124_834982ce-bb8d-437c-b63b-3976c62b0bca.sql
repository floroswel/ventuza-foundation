
-- ============ Sprint A: Queue claim/lock + SLA ============

-- 1) Tabel claim-uri active pe cozi (soft-lock, cu heartbeat + expirare)
CREATE TABLE IF NOT EXISTS public.queue_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue        text NOT NULL,               -- 'reports' | 'appeals' | 'csam' | 'dsa' | 'gdpr' | 'partners' | 'support' | 'riskqueue' | 'breach' | 'ncmec'
  item_id      text NOT NULL,               -- id-ul rândului din coadă (uuid sau text)
  actor_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  UNIQUE (queue, item_id)
);

GRANT SELECT ON public.queue_claims TO authenticated;
GRANT ALL    ON public.queue_claims TO service_role;

ALTER TABLE public.queue_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can read claims"
  ON public.queue_claims FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS queue_claims_expires_idx ON public.queue_claims (expires_at);
CREATE INDEX IF NOT EXISTS queue_claims_actor_idx   ON public.queue_claims (actor_id);

-- 2) RPC: claim item (kick out stale). Return actor curent + expires.
CREATE OR REPLACE FUNCTION public.claim_queue_item(
  _queue text,
  _item_id text,
  _ttl_seconds int DEFAULT 600
) RETURNS TABLE(actor_id uuid, claimed_at timestamptz, expires_at timestamptz, stolen boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_stolen boolean := false;
BEGIN
  IF NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- eliberează stale
  DELETE FROM public.queue_claims
   WHERE queue = _queue AND item_id = _item_id AND expires_at < v_now;

  -- încearcă upsert (dacă alt actor deține și nu e stale, întoarce-l)
  INSERT INTO public.queue_claims (queue, item_id, actor_id, claimed_at, heartbeat_at, expires_at)
  VALUES (_queue, _item_id, v_actor, v_now, v_now, v_now + make_interval(secs => _ttl_seconds))
  ON CONFLICT (queue, item_id) DO UPDATE
    SET actor_id     = CASE WHEN public.queue_claims.actor_id = v_actor THEN v_actor ELSE public.queue_claims.actor_id END,
        heartbeat_at = CASE WHEN public.queue_claims.actor_id = v_actor THEN v_now ELSE public.queue_claims.heartbeat_at END,
        expires_at   = CASE WHEN public.queue_claims.actor_id = v_actor
                             THEN v_now + make_interval(secs => _ttl_seconds)
                             ELSE public.queue_claims.expires_at END;

  RETURN QUERY
    SELECT qc.actor_id, qc.claimed_at, qc.expires_at, v_stolen
      FROM public.queue_claims qc
     WHERE qc.queue = _queue AND qc.item_id = _item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_queue_item(text, text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_queue_item(text, text, int) TO authenticated;

-- 3) RPC: heartbeat (extinde TTL) — doar deținătorul curent
CREATE OR REPLACE FUNCTION public.heartbeat_queue_claim(
  _queue text, _item_id text, _ttl_seconds int DEFAULT 600
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_now timestamptz := now(); v_exp timestamptz;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.queue_claims
     SET heartbeat_at = v_now,
         expires_at   = v_now + make_interval(secs => _ttl_seconds)
   WHERE queue = _queue AND item_id = _item_id AND actor_id = auth.uid()
   RETURNING expires_at INTO v_exp;
  RETURN v_exp;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_queue_claim(text, text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_queue_claim(text, text, int) TO authenticated;

-- 4) RPC: release (owner sau super_admin)
CREATE OR REPLACE FUNCTION public.release_queue_item(_queue text, _item_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.queue_claims
   WHERE queue = _queue AND item_id = _item_id
     AND (actor_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.release_queue_item(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_queue_item(text, text) TO authenticated;

-- 5) RPC: list active claims for a queue (pentru UI badge)
CREATE OR REPLACE FUNCTION public.list_queue_claims(_queue text)
RETURNS TABLE(item_id text, actor_id uuid, display_name text, claimed_at timestamptz, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT qc.item_id, qc.actor_id, COALESCE(p.display_name, 'staff') AS display_name,
         qc.claimed_at, qc.expires_at
    FROM public.queue_claims qc
    LEFT JOIN public.profiles p ON p.id = qc.actor_id
   WHERE qc.queue = _queue
     AND qc.expires_at > now()
     AND public.is_staff(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.list_queue_claims(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_queue_claims(text) TO authenticated;

-- 6) SLA config in app_settings (una singură cheie, cu praguri per queue)
INSERT INTO public.app_settings (key, value, updated_by)
VALUES (
  'sla_thresholds',
  jsonb_build_object(
    'reports',   jsonb_build_object('warn_minutes',  240, 'breach_minutes',  1440),
    'appeals',   jsonb_build_object('warn_minutes', 2880, 'breach_minutes', 10080),
    'csam',      jsonb_build_object('warn_minutes',   60, 'breach_minutes',  1440),
    'dsa',       jsonb_build_object('warn_minutes',  720, 'breach_minutes',  2880),
    'gdpr',      jsonb_build_object('warn_minutes',10080, 'breach_minutes', 43200),
    'partners',  jsonb_build_object('warn_minutes', 1440, 'breach_minutes',  2880),
    'support',   jsonb_build_object('warn_minutes',  240, 'breach_minutes',  1440),
    'riskqueue', jsonb_build_object('warn_minutes',  480, 'breach_minutes',  1440),
    'breach',    jsonb_build_object('warn_minutes', 2400, 'breach_minutes',  4320),
    'ncmec',     jsonb_build_object('warn_minutes',  360, 'breach_minutes',  1440)
  ),
  NULL
)
ON CONFLICT (key) DO NOTHING;

-- 7) Auto-cleanup periodic (fire-and-forget helper — poate fi apelat din pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_queue_claims()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH d AS (DELETE FROM public.queue_claims WHERE expires_at < now() RETURNING 1)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_queue_claims() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_queue_claims() TO service_role;
