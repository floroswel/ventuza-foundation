ALTER TABLE public.album_requests
  ADD CONSTRAINT album_requests_requester_profile_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;