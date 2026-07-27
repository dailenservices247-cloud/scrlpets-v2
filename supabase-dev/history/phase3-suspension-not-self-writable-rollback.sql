-- Rollback for 20260727143208_suspension_not_self_writable.sql.
-- NOTE: reinstating profiles.suspended_at restores the self-writable hole.
alter table public.profiles add column if not exists suspended_at timestamptz;
create or replace function public.is_suspended(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = target_profile and suspended_at is not null);
$$;
drop table if exists public.account_suspensions;
