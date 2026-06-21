
DROP POLICY IF EXISTS "stories_upload_own" ON storage.objects;
CREATE POLICY "stories_upload_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'stories'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "stories_read_authenticated" ON storage.objects;
CREATE POLICY "stories_read_authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "stories_delete_own" ON storage.objects;
CREATE POLICY "stories_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'stories'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
