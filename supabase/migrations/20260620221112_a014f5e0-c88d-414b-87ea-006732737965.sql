
CREATE OR REPLACE FUNCTION public.bump_report_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET report_count = report_count + 1 WHERE id = NEW.reported_id;
  RETURN NEW;
END;
$$;
