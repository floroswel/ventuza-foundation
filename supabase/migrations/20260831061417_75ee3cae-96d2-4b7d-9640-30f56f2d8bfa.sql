CREATE OR REPLACE FUNCTION public.notify_on_tap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  PERFORM public.enqueue_push(NEW.receiver_id, NEW.sender_id, 'taps',
    'Suzeta', 'Ai un salut nou',
    CASE WHEN _slug IS NOT NULL THEN '/u/' || _slug ELSE '/discover' END,
    'tap:' || NEW.sender_id::text);
  PERFORM public.kick_push_dispatch();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_on_woof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _sender_name text;
BEGIN
  SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, payload)
  VALUES (NEW.receiver_id, 'woof', NEW.sender_id,
    jsonb_build_object('sender_name', _sender_name));
  PERFORM public.enqueue_push(NEW.receiver_id, NEW.sender_id, 'woofs',
    'Suzeta', 'Cineva ți-a dat woof', '/notifications',
    'woof:' || NEW.sender_id::text);
  PERFORM public.kick_push_dispatch();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_notify_new_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  PERFORM public.enqueue_push(NEW.favorite_id, NEW.user_id, 'favorites',
    'Suzeta', 'Cineva te-a adăugat la favorite',
    CASE WHEN _slug IS NOT NULL THEN '/u/' || _slug ELSE '/discover' END,
    'fav:' || NEW.user_id::text);
  PERFORM public.kick_push_dispatch();
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_notify_new_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  name_a TEXT; name_b TEXT;
BEGIN
  SELECT display_name INTO name_a FROM public.profiles WHERE id = NEW.user_a;
  SELECT display_name INTO name_b FROM public.profiles WHERE id = NEW.user_b;

  PERFORM public.notify_user(NEW.user_a, NEW.user_b, 'match',
    'New match!', 'You matched with ' || COALESCE(name_b, 'someone'),
    '/messages', NEW.id);
  PERFORM public.notify_user(NEW.user_b, NEW.user_a, 'match',
    'New match!', 'You matched with ' || COALESCE(name_a, 'someone'),
    '/messages', NEW.id);

  PERFORM public.enqueue_push(NEW.user_a, NEW.user_b, 'matches',
    'Suzeta', 'Ai o potrivire nouă', '/matches', 'match:' || NEW.id::text);
  PERFORM public.enqueue_push(NEW.user_b, NEW.user_a, 'matches',
    'Suzeta', 'Ai o potrivire nouă', '/matches', 'match:' || NEW.id::text);
  PERFORM public.kick_push_dispatch();
  RETURN NEW;
END;
$function$;