DROP TRIGGER IF EXISTS trg_enforce_verified_first_message ON public.messages;
DROP FUNCTION IF EXISTS public.enforce_verified_first_message();