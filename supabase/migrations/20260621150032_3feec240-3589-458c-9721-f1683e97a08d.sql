
-- Storage policies for chat-media bucket
-- Path convention: {user_id}/{conversation_id}/{filename}
CREATE POLICY "chat_media_owner_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone authenticated can read; we'll use signed URLs anyway for ephemerality
CREATE POLICY "chat_media_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');
