CREATE OR REPLACE FUNCTION public.enforce_profile_completion_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photos_count int := COALESCE(array_length(NEW.photos, 1), 0);
  v_interests_count int := COALESCE(array_length(NEW.interests, 1), 0);
  v_gender_count int := COALESCE(array_length(NEW.gender, 1), 0);
  v_orientation_count int := COALESCE(array_length(NEW.orientation, 1), 0);
  v_is_moderation boolean := (auth.uid() IS NULL) OR (TG_OP = 'UPDATE' AND auth.uid() IS DISTINCT FROM NEW.id);
BEGIN
  IF v_photos_count > 6 THEN
    RAISE EXCEPTION 'photos_limit_exceeded'
      USING ERRCODE = '23514', HINT = 'Maxim 6 poze per profil.';
  END IF;

  IF NEW.onboarding_completed IS TRUE THEN
    IF NEW.display_name IS NULL OR btrim(NEW.display_name) = '' THEN
      RAISE EXCEPTION 'onboarding_incomplete:display_name' USING ERRCODE = '23514';
    END IF;
    IF NEW.birthdate IS NULL THEN
      RAISE EXCEPTION 'onboarding_incomplete:birthdate' USING ERRCODE = '23514';
    END IF;
    IF v_gender_count < 1 THEN
      RAISE EXCEPTION 'onboarding_incomplete:gender' USING ERRCODE = '23514';
    END IF;
    IF v_orientation_count < 1 THEN
      RAISE EXCEPTION 'onboarding_incomplete:orientation' USING ERRCODE = '23514';
    END IF;
    IF v_interests_count < 3 THEN
      RAISE EXCEPTION 'onboarding_incomplete:interests_min_3' USING ERRCODE = '23514';
    END IF;
    -- Moderarea (server-side / staff) poate scoate ultima poză a unui profil.
    IF v_photos_count < 1 AND NOT v_is_moderation THEN
      RAISE EXCEPTION 'onboarding_incomplete:photos_min_1' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: scoate din profiluri pozele deja respinse de moderatori.
UPDATE public.profiles p
SET photos = (
  SELECT COALESCE(array_agg(x ORDER BY ord), '{}'::text[])
  FROM unnest(p.photos) WITH ORDINALITY AS t(x, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.photo_reviews pr
    WHERE pr.user_id = p.id AND pr.surface = 'profile'
      AND pr.status = 'rejected' AND pr.storage_path = t.x
  )
)
WHERE EXISTS (
  SELECT 1 FROM public.photo_reviews pr
  WHERE pr.user_id = p.id AND pr.surface = 'profile'
    AND pr.status = 'rejected' AND pr.storage_path = ANY(p.photos)
);

UPDATE public.private_albums a
SET photos = (
  SELECT COALESCE(array_agg(x ORDER BY ord), '{}'::text[])
  FROM unnest(a.photos) WITH ORDINALITY AS t(x, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.photo_reviews pr
    WHERE pr.user_id = a.owner_id AND pr.surface = 'album'
      AND pr.status = 'rejected' AND pr.storage_path = t.x
  )
)
WHERE EXISTS (
  SELECT 1 FROM public.photo_reviews pr
  WHERE pr.user_id = a.owner_id AND pr.surface = 'album'
    AND pr.status = 'rejected' AND pr.storage_path = ANY(a.photos)
);