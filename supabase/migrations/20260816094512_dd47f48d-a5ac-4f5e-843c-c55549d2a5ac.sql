DROP POLICY IF EXISTS "authenticated read venue media" ON storage.objects;

CREATE POLICY "venue media owner or staff read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'venue-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_staff(auth.uid())
  )
);