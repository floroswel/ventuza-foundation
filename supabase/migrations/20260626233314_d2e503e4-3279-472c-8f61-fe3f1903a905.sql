
-- Owner can upload/replace/delete inside their own folder: venue-media/{uid}/...
CREATE POLICY "partner upload own venue media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'venue-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "partner update own venue media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'venue-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "partner delete own venue media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'venue-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Read: any authenticated user can fetch a signed URL (covers moderation staff + end users seeing approved content)
CREATE POLICY "authenticated read venue media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'venue-media');
