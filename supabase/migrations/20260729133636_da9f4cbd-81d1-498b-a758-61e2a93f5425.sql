UPDATE public.badge_registry SET criteria_summary = replace(criteria_summary, 'Ventuza', 'Suzeta') WHERE criteria_summary ILIKE '%Ventuza%';
UPDATE public.badge_registry SET label_i18n = jsonb_build_object('ro', replace(label_i18n->>'ro','Ventuza','Suzeta'), 'en', replace(label_i18n->>'en','Ventuza','Suzeta')) WHERE label_i18n::text ILIKE '%Ventuza%';
UPDATE public.badge_registry SET code = 'founder_suzeta' WHERE code = 'founder_ventuza';

DROP FUNCTION IF EXISTS public.admin_send_official_message(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_send_official_message(_target uuid, _body text, _subject text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, created_at)
  VALUES (_target,'admin_message',COALESCE(_subject,'Mesaj oficial Suzeta'),left(_body,200), now());
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_send_official_message(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_official_message(uuid, text, text) TO service_role;