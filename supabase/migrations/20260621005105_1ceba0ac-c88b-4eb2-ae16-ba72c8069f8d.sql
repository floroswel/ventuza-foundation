
CREATE OR REPLACE FUNCTION public.notify_on_tap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_name text;
BEGIN
  SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'tap'::public.notification_type,
    COALESCE(_sender_name,'Cineva') || ' te-a salutat ' || NEW.emoji,
    NULL,
    '/discover'
  );
  RETURN NEW;
END $$;
