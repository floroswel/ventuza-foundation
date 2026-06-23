
CREATE OR REPLACE FUNCTION public.tg_quest_tap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.sender_id, 'taps_sent', 1);
  PERFORM public.increment_quest_progress(NEW.receiver_id, 'taps_received', 1);
  RETURN NEW;
END;
$$;
