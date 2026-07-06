
CREATE OR REPLACE FUNCTION public.tg_notify_new_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reciprocal boolean;
BEGIN
  IF NEW.action NOT IN ('like', 'super') THEN
    RETURN NEW;
  END IF;
  IF NEW.swiper_id = NEW.target_id THEN
    RETURN NEW;
  END IF;

  -- Dacă există deja match între cei doi, trigger-ul de match acoperă notificarea.
  SELECT EXISTS(
    SELECT 1 FROM public.matches
    WHERE (user_a = NEW.swiper_id AND user_b = NEW.target_id)
       OR (user_a = NEW.target_id AND user_b = NEW.swiper_id)
  ) INTO reciprocal;
  IF reciprocal THEN
    RETURN NEW;
  END IF;

  -- Notificare ANONIMĂ (nu dezvăluim identitatea celui care a dat like).
  PERFORM public.notify_user(
    NEW.target_id,
    NEW.swiper_id,
    'like'::public.notification_type,
    'Cuiva îi place de tine 👀',
    'Deschide Ventuza să vezi cine.',
    '/discover',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_like ON public.swipes;
CREATE TRIGGER notify_new_like
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_like();
