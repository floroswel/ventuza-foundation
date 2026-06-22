
-- Public-safe view of profiles (excludes medical, moderation, location, SOS, consent fields).
-- Uses security_invoker = false (default) so it runs with view-owner privileges and bypasses
-- the self-only RLS on `profiles`, while exposing ONLY non-sensitive columns.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id, display_name, birthdate, gender, gender_custom, pronouns, pronouns_custom,
  orientation, looking_for, interests, bio, prompts, photos, verified, verified_at,
  last_seen, tribes, body_type, height_cm, weight_kg, ethnicity, position,
  relationship_status, travel_city, travel_until, boost_until,
  looking_now_until, looking_now_intent, hide_age, hide_distance, hide_online,
  meet_at, scenes, expectations, accept_nsfw_photos,
  voice_prompt_path, voice_prompt_question, voice_prompt_duration_sec,
  anthem, top_artists, zodiac, languages, education, school, job_title, company,
  religion, politics, children, pets, drinking, smoking, cannabis, drugs,
  workout, diet, sleep_schedule, dealbreakers, ideal_match, ask_me_about,
  profile_slug, video_clip_path, voice_bio_url, voice_bio_duration_sec,
  preferred_language, friends_only_mode, incognito,
  created_at, updated_at
FROM public.profiles
WHERE deleted_at IS NULL
  AND (banned_at IS NULL OR banned_at > now())
  AND (suspended_until IS NULL OR suspended_until < now());

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Performance indexes for chat / messaging at scale.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id, sender_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_user_a_last
  ON public.conversations (user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b_last
  ON public.conversations (user_b, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);
