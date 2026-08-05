CREATE OR REPLACE FUNCTION public.get_profile_by_slug(_slug text)
 RETURNS TABLE(id uuid, display_name text, photos text[], verified boolean, verified_at timestamp with time zone, birthdate date, tribes text[], pronouns text, gender text, body_type text, height_cm integer, bio text, ideal_match text, interests text[], ask_me_about text[], anthem jsonb, prompts jsonb, job_title text, zodiac text, voice_prompt_path text, voice_prompt_question text, video_clip_path text, preferred_language text, "position" text, hide_age boolean, profile_slug text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _viewer uuid := auth.uid();
  _maybe_uuid uuid;
BEGIN
  PERFORM public.assert_age_verified();

  BEGIN
    _maybe_uuid := _slug::uuid;
  EXCEPTION WHEN others THEN
    _maybe_uuid := NULL;
  END;

  RETURN QUERY
  SELECT
    p.id, p.display_name, p.photos, p.verified, p.verified_at,
    CASE WHEN p.hide_age THEN NULL::date
         ELSE make_date(EXTRACT(YEAR FROM p.birthdate)::int, 1, 1) END,
    p.tribes, p.pronouns, p.gender, p.body_type, p.height_cm, p.bio,
    p.ideal_match, p.interests, p.ask_me_about, p.anthem, p.prompts,
    p.job_title, p.zodiac, p.voice_prompt_path, p.voice_prompt_question,
    p.video_clip_path, p.preferred_language, p."position", p.hide_age, p.profile_slug
  FROM public.profiles p
  WHERE (p.profile_slug = _slug OR (_maybe_uuid IS NOT NULL AND p.id = _maybe_uuid))
    AND p.deleted_at IS NULL
    AND (p.banned_at IS NULL OR p.banned_at > now())
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = _viewer AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = _viewer)
    );
END;
$function$;