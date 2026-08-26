CREATE TABLE IF NOT EXISTS public.photo_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  ai_allowed boolean,
  ai_reason text,
  reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_reviews_status_chk CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT ON public.photo_reviews TO authenticated;
GRANT ALL ON public.photo_reviews TO service_role;

ALTER TABLE public.photo_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo_reviews_select_own_or_staff" ON public.photo_reviews;
CREATE POLICY "photo_reviews_select_own_or_staff"
  ON public.photo_reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "photo_reviews_insert_own" ON public.photo_reviews;
CREATE POLICY "photo_reviews_insert_own"
  ON public.photo_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS photo_reviews_pending_idx
  ON public.photo_reviews (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS photo_reviews_user_idx
  ON public.photo_reviews (user_id, status);