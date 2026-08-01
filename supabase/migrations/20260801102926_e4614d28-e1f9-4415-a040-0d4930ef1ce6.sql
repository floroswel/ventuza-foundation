-- Tap → profilul expeditorului
CREATE OR REPLACE FUNCTION public.notify_on_tap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _sender_name text; _slug text;
BEGIN
  SELECT display_name, profile_slug INTO _sender_name, _slug FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'tap'::public.notification_type,
    COALESCE(_sender_name,'Cineva') || ' te-a salutat ' || NEW.emoji,
    NULL,
    CASE WHEN _slug IS NOT NULL THEN '/u/' || _slug ELSE '/discover' END
  );
  RETURN NEW;
END $function$;

-- Like: rămâne anonim, dar cu brandul corect
CREATE OR REPLACE FUNCTION public.tg_notify_new_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE reciprocal boolean;
BEGIN
  IF NEW.action NOT IN ('like', 'super') THEN RETURN NEW; END IF;
  IF NEW.swiper_id = NEW.target_id THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.matches
    WHERE (user_a = NEW.swiper_id AND user_b = NEW.target_id)
       OR (user_a = NEW.target_id AND user_b = NEW.swiper_id)
  ) INTO reciprocal;
  IF reciprocal THEN RETURN NEW; END IF;
  PERFORM public.notify_user(
    NEW.target_id, NEW.swiper_id, 'like'::public.notification_type,
    'Cuiva îi place de tine 👀', 'Deschide Suzeta să vezi cine.', '/discover', NEW.id
  );
  RETURN NEW;
END; $function$;

-- Favorite → notificare + link către profil
CREATE OR REPLACE FUNCTION public.tg_notify_new_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _name text; _slug text;
BEGIN
  IF NEW.user_id = NEW.favorite_id THEN RETURN NEW; END IF;
  SELECT display_name, profile_slug INTO _name, _slug FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link, entity_id)
  VALUES (
    NEW.favorite_id,
    NEW.user_id,
    'favorite'::public.notification_type,
    COALESCE(_name,'Cineva') || ' te-a adăugat la favorite ⭐',
    NULL,
    CASE WHEN _slug IS NOT NULL THEN '/u/' || _slug ELSE '/discover' END,
    NEW.id
  );
  RETURN NEW;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.tg_notify_new_favorite() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_new_favorite ON public.favorites;
CREATE TRIGGER trg_notify_new_favorite
AFTER INSERT ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_favorite();