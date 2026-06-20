-- Owner manages own files
CREATE POLICY "private albums: owner full access"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'private-albums' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'private-albums' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Granted viewers can read
CREATE POLICY "private albums: granted viewers read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'private-albums'
  AND EXISTS (
    SELECT 1 FROM public.album_unlocks au
    WHERE au.owner_id::text = (storage.foldername(name))[1]
      AND au.viewer_id = auth.uid()
  )
);