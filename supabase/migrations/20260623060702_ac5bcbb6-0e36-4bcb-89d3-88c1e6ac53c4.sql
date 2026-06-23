CREATE OR REPLACE FUNCTION public.tg_messages_only_read_at_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.created_at <> OLD.created_at
     OR NEW.audio_duration_ms IS DISTINCT FROM OLD.audio_duration_ms
     OR NEW.view_once IS DISTINCT FROM OLD.view_once
     OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
  THEN
    RAISE EXCEPTION 'Only controlled message updates are allowed';
  END IF;

  IF NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND NEW.body = ''
     AND NEW.media_url IS NULL
     AND NEW.media_type = 'text'
  THEN
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.media_type IS DISTINCT FROM OLD.media_type
     OR NEW.media_url IS DISTINCT FROM OLD.media_url
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'Messages cannot be edited after sending';
  END IF;

  IF OLD.media_type = 'location' THEN
    RETURN NEW;
  END IF;

  IF NEW.location_lat IS DISTINCT FROM OLD.location_lat
     OR NEW.location_lng IS DISTINCT FROM OLD.location_lng
  THEN
    RAISE EXCEPTION 'Only live location messages can update location';
  END IF;

  RETURN NEW;
END;
$$;