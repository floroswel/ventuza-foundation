
drop policy if exists "ad_campaigns_owner_all" on public.ad_campaigns;
create policy "ad_campaigns_owner_all" on public.ad_campaigns
for all to authenticated
using (exists (select 1 from public.advertisers a where a.id = ad_campaigns.advertiser_id and a.owner_id = auth.uid()))
with check (
  exists (select 1 from public.advertisers a where a.id = ad_campaigns.advertiser_id and a.owner_id = auth.uid())
  and status is distinct from 'active'
);

drop policy if exists "Authenticated users can submit business application" on public.business_applications;
create policy "Authenticated users can submit business application" on public.business_applications
for insert to authenticated
with check (
  accepts_terms = true and accepts_dpa = true and accepts_lgbt_charter = true
  and (user_id is null or user_id = auth.uid())
  and status = 'pending'::business_app_status
);

drop policy if exists "Authenticated users can propose events" on public.events;
create policy "Authenticated users can propose events" on public.events
for insert to authenticated
with check (
  host_id = auth.uid()
  and is_published = false
  and moderation_status <> 'approved'::moderation_status
);
