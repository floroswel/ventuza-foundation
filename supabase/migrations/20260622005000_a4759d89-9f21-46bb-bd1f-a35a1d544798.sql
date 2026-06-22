
create table if not exists public.advertisers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_name text not null,
  contact_email text not null,
  contact_phone text,
  website text,
  category text not null default 'venue',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.advertisers to authenticated;
grant all on public.advertisers to service_role;
alter table public.advertisers enable row level security;
create policy "advertisers_owner_read" on public.advertisers for select to authenticated using (auth.uid() = owner_id);
create policy "advertisers_owner_insert" on public.advertisers for insert to authenticated with check (auth.uid() = owner_id);
create policy "advertisers_owner_update" on public.advertisers for update to authenticated using (auth.uid() = owner_id);
create policy "advertisers_owner_delete" on public.advertisers for delete to authenticated using (auth.uid() = owner_id);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete cascade,
  placement text not null default 'events_banner',
  title text not null,
  body text,
  image_url text,
  cta_label text default 'Află mai mult',
  cta_url text,
  target_event_id uuid references public.events(id) on delete set null,
  city text,
  budget_cents integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'pending',
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.ad_campaigns to anon, authenticated;
grant insert, update, delete on public.ad_campaigns to authenticated;
grant all on public.ad_campaigns to service_role;
alter table public.ad_campaigns enable row level security;
create policy "ad_campaigns_public_active" on public.ad_campaigns for select to anon, authenticated using (status = 'active' and ends_at > now() and starts_at <= now());
create policy "ad_campaigns_owner_all" on public.ad_campaigns for all to authenticated
  using (exists (select 1 from public.advertisers a where a.id = advertiser_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.advertisers a where a.id = advertiser_id and a.owner_id = auth.uid()));
create index if not exists ad_campaigns_active_idx on public.ad_campaigns (placement, city, ends_at) where status = 'active';

create table if not exists public.ad_events (
  id bigserial primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('impression', 'click')),
  created_at timestamptz not null default now()
);
grant insert on public.ad_events to anon, authenticated;
grant all on public.ad_events to service_role;
alter table public.ad_events enable row level security;
create policy "ad_events_anyone_insert" on public.ad_events for insert to anon, authenticated with check (true);

create table if not exists public.woofs (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);
grant select, insert, delete on public.woofs to authenticated;
grant all on public.woofs to service_role;
alter table public.woofs enable row level security;
create policy "woofs_sender_insert" on public.woofs for insert to authenticated with check (auth.uid() = sender_id);
create policy "woofs_participant_read" on public.woofs for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "woofs_sender_delete" on public.woofs for delete to authenticated using (auth.uid() = sender_id);
create index if not exists woofs_receiver_idx on public.woofs (receiver_id, created_at desc);
