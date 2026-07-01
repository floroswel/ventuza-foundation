
-- ============================================================================
-- VAL 1 + 2 — ADMIN OPERAȚIONAL ENTERPRISE
-- Support Tickets · Appeals (DSA Art. 20) · Impersonation Audit · Broadcast v2
-- Kill Switches · Force-Update Gate · MRR · Retention · Funnel
-- ============================================================================

-- ---------------- SUPPORT TICKETS ----------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('account','billing','abuse','safety','bug','feature','partner','other')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','pending','waiting_user','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  related_type text CHECK (related_type IN ('report','appeal','invoice','venue','event','offer','partner_app','none')),
  related_id text,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_msg_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets (status, priority, last_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON public.support_tickets (assignee_id, status);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets: user reads own"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "tickets: user creates own"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets: staff updates"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('user','staff','system')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  internal_note boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs_ticket ON public.support_ticket_messages (ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickmsg: read own or staff"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    (public.is_staff(auth.uid()))
    OR (
      NOT internal_note
      AND EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
  );
CREATE POLICY "tickmsg: user replies own"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_staff(auth.uid())
      OR (
        author_role = 'user'
        AND internal_note = false
        AND EXISTS (SELECT 1 FROM public.support_tickets t
                    WHERE t.id = ticket_id AND t.user_id = auth.uid())
      )
    )
  );

-- update last_msg_at + updated_at pe insert mesaj
CREATE OR REPLACE FUNCTION public.ticket_touch_on_msg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets
     SET last_msg_at = NEW.created_at,
         updated_at = now(),
         first_response_at = COALESCE(first_response_at,
           CASE WHEN NEW.author_role = 'staff' AND NOT NEW.internal_note THEN NEW.created_at END),
         status = CASE
                    WHEN status = 'closed' THEN 'closed'
                    WHEN NEW.author_role = 'user' THEN 'open'
                    WHEN NEW.author_role = 'staff' AND NOT NEW.internal_note THEN 'waiting_user'
                    ELSE status
                  END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ticket_touch ON public.support_ticket_messages;
CREATE TRIGGER trg_ticket_touch AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.ticket_touch_on_msg();

-- ---------------- APPEALS (DSA Art. 20) ----------------
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ban','suspension','content_removed','account_deleted','photo_rejected','other')),
  action_ref text,
  original_reason text,
  user_statement text NOT NULL CHECK (char_length(user_statement) BETWEEN 20 AND 4000),
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','granted','denied','withdrawn')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, action_ref)
);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.appeals (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.appeals TO authenticated;
GRANT UPDATE ON public.appeals TO service_role;
GRANT ALL ON public.appeals TO service_role;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appeals: own read"
  ON public.appeals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appeals: own create"
  ON public.appeals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "appeals: user withdraw"
  ON public.appeals FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('open','under_review'))
  WITH CHECK (user_id = auth.uid() AND status = 'withdrawn');

-- ---------------- IMPERSONATION LOG (append-only) ----------------
CREATE TABLE IF NOT EXISTS public.admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('support','abuse_review','bug_repro','legal','other')),
  justification text NOT NULL CHECK (char_length(justification) >= 20),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  fields_accessed jsonb NOT NULL DEFAULT '[]'::jsonb,
  ip inet,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_impers_actor ON public.admin_impersonation_log (actor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impers_target ON public.admin_impersonation_log (target_user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.admin_impersonation_log TO service_role;
ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impers: auditor+super read"
  ON public.admin_impersonation_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','auditor']::app_role[]));

CREATE OR REPLACE FUNCTION public.prevent_impers_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'admin_impersonation_log is append-only';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.actor_id, OLD.target_user_id, OLD.started_at) IS DISTINCT FROM (NEW.actor_id, NEW.target_user_id, NEW.started_at) THEN
    RAISE EXCEPTION 'admin_impersonation_log core fields immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_impers_immutable ON public.admin_impersonation_log;
CREATE TRIGGER trg_impers_immutable BEFORE UPDATE OR DELETE ON public.admin_impersonation_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_impers_mutation();

-- ---------------- BROADCAST CAMPAIGNS (v2) ----------------
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 1000),
  link text CHECK (link IS NULL OR link ~ '^https?://'),
  channel text NOT NULL DEFAULT 'inapp' CHECK (channel IN ('inapp','push','both')),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bc_status ON public.broadcast_campaigns (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.broadcast_campaigns TO service_role;
GRANT ALL ON public.broadcast_campaigns TO service_role;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bc: staff read"
  ON public.broadcast_campaigns FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------------- KILL SWITCHES + MIN VERSION în app_settings ----------------
INSERT INTO public.app_settings (key, value)
VALUES
  ('kill_switches', jsonb_build_object(
     'chat', false, 'matching', false, 'uploads', false,
     'discover', false, 'signup', false, 'partner_portal', false
   )),
  ('min_supported_version', jsonb_build_object(
     'web', '0.0.0', 'ios', '0.0.0', 'android', '0.0.0',
     'force_update_message', 'Actualizează aplicația pentru a continua'
   ))
ON CONFLICT (key) DO NOTHING;

-- ---------------- INTELLIGENCE: MRR / RETENTION / FUNNEL ----------------
-- MRR / ARR / partner subscription stats (SECURITY DEFINER, staff-only)
CREATE OR REPLACE FUNCTION public.admin_revenue_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH plan_prices AS (
    SELECT code, COALESCE((price_snapshot->>'monthly_ron')::numeric, 0) AS monthly_ron
    FROM public.partner_plans
  ),
  active_subs AS (
    SELECT s.owner_id, s.plan_code, s.status, s.current_period_end,
           COALESCE(p.monthly_ron, 0) AS monthly_ron
      FROM public.partner_subscriptions s
      LEFT JOIN plan_prices p ON p.code = s.plan_code
     WHERE s.status IN ('active','grace')
  ),
  invoices_30d AS (
    SELECT SUM(total_cents)::bigint AS cents
      FROM public.partner_invoices
     WHERE status = 'paid' AND paid_at > now() - interval '30 days'
  ),
  invoices_365d AS (
    SELECT SUM(total_cents)::bigint AS cents
      FROM public.partner_invoices
     WHERE status = 'paid' AND paid_at > now() - interval '365 days'
  )
  SELECT jsonb_build_object(
    'mrr_ron', COALESCE((SELECT SUM(monthly_ron) FROM active_subs), 0),
    'arr_ron', COALESCE((SELECT SUM(monthly_ron) FROM active_subs), 0) * 12,
    'active_subs', (SELECT COUNT(*) FROM active_subs),
    'active_subs_by_plan', COALESCE(
      (SELECT jsonb_object_agg(plan_code, cnt)
         FROM (SELECT plan_code, COUNT(*) cnt FROM active_subs GROUP BY plan_code) t),
      '{}'::jsonb),
    'grace_subs', (SELECT COUNT(*) FROM active_subs WHERE status = 'grace'),
    'revenue_30d_ron', COALESCE((SELECT cents FROM invoices_30d), 0) / 100.0,
    'revenue_365d_ron', COALESCE((SELECT cents FROM invoices_365d), 0) / 100.0,
    'invoices_unpaid_overdue', (
      SELECT COUNT(*) FROM public.partner_invoices
       WHERE status IN ('pending_payment','overdue') AND due_at < now()
    ),
    'churned_last_30d', (
      SELECT COUNT(*) FROM public.partner_subscriptions
       WHERE status IN ('cancelled','free_downgraded')
         AND current_period_end > now() - interval '30 days'
    )
  ) INTO v_result;

  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_revenue_stats() TO authenticated;

-- Retention cohort D1/D7/D30 pe ultimele 30 de zile de cohorte
CREATE OR REPLACE FUNCTION public.admin_retention_cohorts(_days int DEFAULT 30)
RETURNS TABLE(cohort_day date, signups int, d1 int, d7 int, d30 int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT date_trunc('day', created_at)::date AS d, id
      FROM public.profiles
     WHERE created_at > now() - make_interval(days => _days + 30)
  ),
  activity AS (
    -- ultima activitate = ultima interacțiune socială disponibilă
    SELECT p.id,
           GREATEST(
             p.last_active_at,
             p.updated_at
           ) AS last_active
      FROM public.profiles p
  )
  SELECT c.d AS cohort_day,
         COUNT(*)::int AS signups,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '1 day'
             AND a.last_active <  c.d + interval '2 day'
         )::int AS d1,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '7 day'
             AND a.last_active <  c.d + interval '8 day'
         )::int AS d7,
         COUNT(*) FILTER (
           WHERE a.last_active >= c.d + interval '30 day'
             AND a.last_active <  c.d + interval '31 day'
         )::int AS d30
    FROM cohorts c
    LEFT JOIN activity a ON a.id = c.id
   WHERE c.d >= (CURRENT_DATE - _days)
   GROUP BY c.d
   ORDER BY c.d DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_retention_cohorts(int) TO authenticated;

-- Funnel signup → age_verified → profile complete → first swipe → first match → first message
CREATE OR REPLACE FUNCTION public.admin_funnel_stats(_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
  since timestamptz := now() - make_interval(days => _days);
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT id, birthdate, age_status, display_name, bio, created_at
      FROM public.profiles
     WHERE created_at > since
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'signups', (SELECT COUNT(*) FROM base),
    'birthdate_set', (SELECT COUNT(*) FROM base WHERE birthdate IS NOT NULL),
    'age_verified', (SELECT COUNT(*) FROM base WHERE age_status = 'verified'),
    'profile_complete', (SELECT COUNT(*) FROM base WHERE display_name IS NOT NULL AND bio IS NOT NULL),
    'first_swipe', (
      SELECT COUNT(DISTINCT s.swiper_id) FROM public.swipes s
        JOIN base b ON b.id = s.swiper_id
    ),
    'first_match', (
      SELECT COUNT(DISTINCT m.user_a) FROM public.matches m
        JOIN base b ON b.id = m.user_a
    ),
    'first_message_sent', (
      SELECT COUNT(DISTINCT ms.sender_id) FROM public.messages ms
        JOIN base b ON b.id = ms.sender_id
    ),
    'ticket_opened', (
      SELECT COUNT(DISTINCT t.user_id) FROM public.support_tickets t
        JOIN base b ON b.id = t.user_id
    )
  ) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_funnel_stats(int) TO authenticated;

-- Log staff acțiune pe ticket / appeal centralizat
CREATE OR REPLACE FUNCTION public.admin_staff_ticket_action(
  _ticket_id uuid, _new_status text, _assignee uuid, _priority text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.support_tickets
     SET status = COALESCE(_new_status, status),
         assignee_id = COALESCE(_assignee, assignee_id),
         priority = COALESCE(_priority, priority),
         resolved_at = CASE WHEN _new_status = 'resolved' AND resolved_at IS NULL THEN now() ELSE resolved_at END,
         closed_at = CASE WHEN _new_status = 'closed' AND closed_at IS NULL THEN now() ELSE closed_at END,
         updated_at = now()
   WHERE id = _ticket_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_staff_ticket_action(uuid, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_decide_appeal(
  _appeal_id uuid, _decision text, _decision_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('granted','denied','under_review') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF _decision IN ('granted','denied') AND (_decision_reason IS NULL OR char_length(_decision_reason) < 10) THEN
    RAISE EXCEPTION 'decision_reason_required (min 10 chars)';
  END IF;
  UPDATE public.appeals
     SET status = _decision,
         decision_reason = _decision_reason,
         reviewed_by = auth.uid(),
         reviewed_at = CASE WHEN _decision IN ('granted','denied') THEN now() ELSE reviewed_at END,
         updated_at = now()
   WHERE id = _appeal_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_decide_appeal(uuid, text, text) TO authenticated;
