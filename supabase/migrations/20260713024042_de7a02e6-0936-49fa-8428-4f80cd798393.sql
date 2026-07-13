-- =====================================================================
-- RATE LIMIT — SOCIAL ENDPOINTS (send_message, swipe, report, sos)
-- Enforced la nivel DB prin trigger BEFORE INSERT. UI nu poate ocoli.
-- Folosește funcția existentă `rl_enforce(action, max, window_seconds)`
-- (vezi migrarea 20260630165614). Contorizează în `public.rate_limit_log`.
-- =====================================================================

-- ----- Ensure rl_enforce exists in the expected shape (idempotent) -----
-- rl_enforce este definit deja; nu-l atingem. Doar adăugăm trigger-e.

-- ----- 1) MESSAGES: 60 msgs / hour / user -----
CREATE OR REPLACE FUNCTION public.trg_rl_send_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Doar mesajele reale (nu update-uri / re-sync). BEFORE INSERT enforces.
  IF NEW.sender_id IS NOT NULL AND NEW.sender_id = auth.uid() THEN
    PERFORM public.rl_enforce('send_message', 60, 3600);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_send_message ON public.messages;
CREATE TRIGGER rl_send_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_send_message();

-- ----- 2) SWIPES: 500 swipes / hour / user -----
CREATE OR REPLACE FUNCTION public.trg_rl_swipe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.swiper_id IS NOT NULL AND NEW.swiper_id = auth.uid() THEN
    PERFORM public.rl_enforce('swipe', 500, 3600);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_swipe ON public.swipes;
CREATE TRIGGER rl_swipe
  BEFORE INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_swipe();

-- ----- 3) REPORTS: 10 rapoarte / hour / user -----
CREATE OR REPLACE FUNCTION public.trg_rl_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reporter_id IS NOT NULL AND NEW.reporter_id = auth.uid() THEN
    PERFORM public.rl_enforce('report', 10, 3600);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_report ON public.reports;
CREATE TRIGGER rl_report
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_report();

-- ----- 4) SOS: NU blocăm hard (safety-critical) — doar logăm anti-abuz.
-- Loghează în rate_limit_log dar NU raise dacă depășește. Alert la 20+/hour.
CREATE OR REPLACE FUNCTION public.trg_rl_sos_log_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.rate_limit_log
    WHERE user_id = v_uid AND action = 'sos'
      AND created_at > now() - interval '1 hour';
  INSERT INTO public.rate_limit_log(user_id, action) VALUES (v_uid, 'sos');
  -- Anti-abuz: dacă > 20 SOS-uri/oră → NU blocăm, dar marcăm în audit
  -- log pentru review moderator (safety > convenience).
  IF v_count >= 20 THEN
    BEGIN
      INSERT INTO public.admin_audit_log (
        actor_id, action, target_table, target_id,
        after_data, severity
      ) VALUES (
        v_uid, 'sos.excessive', 'sos_events', NEW.id::text,
        jsonb_build_object('count_last_hour', v_count + 1),
        'warning'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- niciodată nu blocăm SOS pentru un log failure
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rl_sos_log_only ON public.sos_events;
CREATE TRIGGER rl_sos_log_only
  BEFORE INSERT ON public.sos_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_rl_sos_log_only();

COMMENT ON FUNCTION public.trg_rl_send_message() IS
  'Rate limit: 60 mesaje/oră/user. Depășire → rate_limited:send_message (53400).';
COMMENT ON FUNCTION public.trg_rl_swipe() IS
  'Rate limit: 500 swipes/oră/user. Depășire → rate_limited:swipe (53400).';
COMMENT ON FUNCTION public.trg_rl_report() IS
  'Rate limit: 10 rapoarte/oră/user. Depășire → rate_limited:report (53400).';
COMMENT ON FUNCTION public.trg_rl_sos_log_only() IS
  'SOS log-only rate tracking. Safety-critical: NICIODATĂ nu blocăm. Peste 20/oră → audit alert.';
