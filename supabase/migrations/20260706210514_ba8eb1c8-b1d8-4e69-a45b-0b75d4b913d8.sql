ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.policy_rules_touch() SET search_path = public;
ALTER FUNCTION public.prevent_dispatch_log_mutation() SET search_path = public;
ALTER FUNCTION public.prevent_impers_mutation() SET search_path = public;
ALTER FUNCTION public.prevent_policy_version_mutation() SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;