REVOKE SELECT ON public.messages FROM authenticated;
GRANT SELECT (
  id,
  conversation_id,
  sender_id,
  body,
  read_at,
  created_at,
  reactions,
  media_type,
  media_url,
  audio_duration_ms,
  expires_at,
  view_once,
  viewed_at,
  reply_to_id,
  deleted_at,
  voice_url,
  voice_duration_sec,
  translated_text
) ON public.messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;