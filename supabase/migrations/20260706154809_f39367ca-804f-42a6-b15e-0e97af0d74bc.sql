-- Notify on woof (mirror al taps_notify): creează row în notifications pentru
-- badge + toast in-app. Idempotent — drop trigger dacă există și recreează.
CREATE OR REPLACE FUNCTION public.notify_on_woof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_name text;
BEGIN
  SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, payload)
  VALUES (NEW.receiver_id, 'woof', NEW.sender_id,
    jsonb_build_object('sender_name', _sender_name));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_on_woof() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS woofs_notify ON public.woofs;
CREATE TRIGGER woofs_notify AFTER INSERT ON public.woofs
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_woof();