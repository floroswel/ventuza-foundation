-- Server-side mirror of client onboarding rules on public.profiles
CREATE OR REPLACE FUNCTION public.enforce_profile_completion_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_photos_count int := COALESCE(array_length(NEW.photos, 1), 0);
  v_interests_count int := COALESCE(array_length(NEW.interests, 1), 0);
  v_gender_count int := COALESCE(array_length(NEW.gender, 1), 0);
  v_orientation_count int := COALESCE(array_length(NEW.orientation, 1), 0);
BEGIN
  -- Hard cap: at most 6 photos, always. Mirrors PhotoManager MAX_PHOTOS.
  IF v_photos_count > 6 THEN
    RAISE EXCEPTION 'photos_limit_exceeded'
      USING ERRCODE = '23514',
            HINT = 'Maxim 6 poze per profil.';
  END IF;

  -- When the profile is (or becomes) completed, enforce onboarding minimums.
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

    IF v_photos_count < 1 THEN
      RAISE EXCEPTION 'onboarding_incomplete:photos_min_1' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_completion_rules_trg ON public.profiles;
CREATE TRIGGER enforce_profile_completion_rules_trg
  BEFORE INSERT OR UPDATE OF photos, interests, gender, orientation,
                             display_name, birthdate, onboarding_completed
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_completion_rules();
