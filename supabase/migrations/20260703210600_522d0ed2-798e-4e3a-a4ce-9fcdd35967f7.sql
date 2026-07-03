ALTER TABLE public.partner_broadcasts
  ADD COLUMN IF NOT EXISTS push_delivered integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_queued  integer NOT NULL DEFAULT 0;