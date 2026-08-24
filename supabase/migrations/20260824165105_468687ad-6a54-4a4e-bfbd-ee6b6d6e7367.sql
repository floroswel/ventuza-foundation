-- Allow reading a conversation partner's profile photo even when they are incognito.
-- Incognito hides you from Discover/visitors, but must not break existing chats.
create or replace function public.shares_conversation_with(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.conversations c
    where (c.user_a = _a and c.user_b = _b)
       or (c.user_a = _b and c.user_b = _a)
  ) and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = _a and b.blocked_id = _b)
       or (b.blocker_id = _b and b.blocked_id = _a)
  );
$$;

revoke all on function public.shares_conversation_with(uuid, uuid) from public, anon;
grant execute on function public.shares_conversation_with(uuid, uuid) to authenticated, service_role;

drop policy if exists "profile_photos_conversation_partner_read" on storage.objects;
create policy "profile_photos_conversation_partner_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and public.shares_conversation_with((storage.foldername(name))[1]::uuid, auth.uid())
);