
DO $$ BEGIN
  CREATE POLICY "profile-media owners write"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profile-media authenticated read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'profile-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
