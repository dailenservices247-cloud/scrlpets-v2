-- Profiles to hide from the caller's feed: everyone they blocked, plus anyone who
-- blocked them. Definer so the caller can see the incoming direction without
-- reading others' block rows (which RLS forbids).
create or replace function public.blocked_profile_ids()
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id as profile_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id as profile_id from public.blocks where blocked_id = auth.uid();
$$;

revoke execute on function public.blocked_profile_ids() from anon, public;
grant execute on function public.blocked_profile_ids() to authenticated;
