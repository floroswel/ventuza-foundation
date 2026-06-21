
-- Add matches to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Ensure UPDATE payloads contain all columns (needed for read receipts, match details)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Hot-path index for online / fresh sorting on discover
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen DESC);

-- Pagination helper for messages thread (created_at ASC scroll)
CREATE INDEX IF NOT EXISTS msg_conv_created_asc_idx ON public.messages (conversation_id, created_at);

-- Composite for matches lookup per user
CREATE INDEX IF NOT EXISTS matches_user_a_idx ON public.matches (user_a, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_user_b_idx ON public.matches (user_b, created_at DESC);
