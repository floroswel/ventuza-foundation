
CREATE TABLE IF NOT EXISTS public.support_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ro',
  active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_macros TO authenticated;
GRANT ALL ON public.support_macros TO service_role;

ALTER TABLE public.support_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view macros" ON public.support_macros
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage macros" ON public.support_macros
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_support_macros_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS support_macros_updated_at ON public.support_macros;
CREATE TRIGGER support_macros_updated_at
  BEFORE UPDATE ON public.support_macros
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_macros_updated_at();

-- CSAT columns
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS csat_score SMALLINT CHECK (csat_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS csat_feedback TEXT,
  ADD COLUMN IF NOT EXISTS csat_submitted_at TIMESTAMPTZ;

-- CSAT RPC: user submits rating on own resolved/closed ticket
CREATE OR REPLACE FUNCTION public.submit_ticket_csat(
  _ticket_id UUID,
  _score SMALLINT,
  _feedback TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_status TEXT;
BEGIN
  IF _score < 1 OR _score > 5 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  SELECT user_id, status INTO v_owner, v_status
    FROM public.support_tickets WHERE id = _ticket_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_status NOT IN ('resolved','closed') THEN RAISE EXCEPTION 'ticket_not_resolved'; END IF;
  UPDATE public.support_tickets
    SET csat_score = _score,
        csat_feedback = LEFT(COALESCE(_feedback,''), 2000),
        csat_submitted_at = now()
    WHERE id = _ticket_id;
END; $$;

REVOKE ALL ON FUNCTION public.submit_ticket_csat(UUID, SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_ticket_csat(UUID, SMALLINT, TEXT) TO authenticated;

-- Increment macro usage counter
CREATE OR REPLACE FUNCTION public.increment_macro_usage(_key TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.support_macros SET usage_count = usage_count + 1 WHERE key = _key;
END; $$;

REVOKE ALL ON FUNCTION public.increment_macro_usage(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_macro_usage(TEXT) TO authenticated;

-- Seed default macros
INSERT INTO public.support_macros (key, title, category, body, lang) VALUES
  ('greet_ro', 'Salut standard (RO)', 'greeting', 'Bună! Mulțumim că ne-ai contactat. Ne uităm imediat pe situația ta și revenim în cel mai scurt timp posibil.', 'ro'),
  ('close_ro', 'Închidere ticket (RO)', 'closing', 'Marchez ticketul ca rezolvat. Dacă mai apar probleme, redeschide-l oricând. Îți mulțumim!', 'ro'),
  ('need_info_ro', 'Cerere informații (RO)', 'info', 'Pentru a te ajuta mai rapid, ai putea să ne trimiți: (1) capturi de ecran, (2) pașii exacți urmați, (3) modelul telefonului și versiunea aplicației? Mulțumim!', 'ro'),
  ('ban_appeal_ro', 'Instrucțiuni contestație ban (RO)', 'moderation', 'Poți depune o contestație direct din Setări → Contestații. Vom analiza cazul în maxim 7 zile lucrătoare conform DSA Art. 20.', 'ro'),
  ('billing_ro', 'Facturare parteneri (RO)', 'billing', 'Pentru facturi și plăți B2B, vezi Portal Partener → Facturare. Confirmarea plății se face manual în 24-48h după recepția OP-ului bancar.', 'ro'),
  ('safety_ro', 'Siguranță / întâlniri (RO)', 'safety', 'Îți recomandăm să citești ghidul nostru de siguranță: /safety. În caz de pericol imediat, sună 112. Resurse LGBTQ+: ACCEPT (021.252.16.20), ARAS (021.323.68.68).', 'ro')
ON CONFLICT (key) DO NOTHING;
