CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('google_play','apple','stripe','manual')),
  product_id text NOT NULL,
  purchase_token text,
  original_transaction_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','cancelled','expired','refunded')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  auto_renew boolean DEFAULT true,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, purchase_token)
);
CREATE INDEX IF NOT EXISTS subscriptions_user_active_idx ON public.subscriptions (user_id, status, expires_at);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, anon;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"matches":true,"messages":true,"likes":true,"events":true,"marketing":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;