-- Phase 7: fixed-role multi-member brand RBAC.
-- Roles: owner, admin, contributor. Dev project only.
-- Rollback: supabase-dev/phase7-brand-rbac-rollback.sql

alter table public.brand_memberships
  add constraint brand_memberships_role_check
  check (role in ('owner', 'admin', 'contributor'));

create table public.brand_membership_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('member_added', 'role_changed', 'member_removed')),
  previous_role text check (previous_role is null or previous_role in ('owner', 'admin', 'contributor')),
  new_role text check (new_role is null or new_role in ('owner', 'admin', 'contributor')),
  created_at timestamptz not null default now()
);

create index idx_brand_membership_events_brand_created
  on public.brand_membership_events(brand_id, created_at desc);

alter table public.brand_membership_events enable row level security;

-- Caller-scoped helpers avoid self-referential membership RLS.
create or replace function public.brand_membership_role(target_brand_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
    from public.brand_memberships m
   where m.brand_id = target_brand_id
     and m.profile_id = auth.uid()
   limit 1;
$$;

create or replace function public.is_brand_member(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.brand_membership_role(target_brand_id) is not null;
$$;

create or replace function public.is_brand_manager(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.brand_membership_role(target_brand_id) in ('owner', 'admin'), false);
$$;

revoke execute on function public.brand_membership_role(uuid) from anon, public;
revoke execute on function public.is_brand_member(uuid) from anon, public;
revoke execute on function public.is_brand_manager(uuid) from anon, public;
grant execute on function public.brand_membership_role(uuid) to authenticated;
grant execute on function public.is_brand_member(uuid) to authenticated;
grant execute on function public.is_brand_manager(uuid) to authenticated;

-- Members see themselves; managers see the roster.
drop policy "read own memberships" on public.brand_memberships;
create policy "read accessible brand memberships" on public.brand_memberships
for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.is_brand_manager(brand_id)
);

-- Brand creation may only create the immutable primary owner's row.
drop policy "own insert memberships" on public.brand_memberships;
create policy "own insert memberships" on public.brand_memberships
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and role = 'owner'
  and exists (
    select 1
      from public.brands b
     where b.id = brand_id
       and b.owner_id = (select auth.uid())
  )
);

create policy "managers read membership events" on public.brand_membership_events
for select to authenticated
using (public.is_brand_manager(brand_id));

grant select on public.brand_membership_events to authenticated;
revoke insert, update, delete on public.brand_membership_events from anon, authenticated, public;

create or replace function public.add_brand_member(
  target_brand_id uuid,
  target_profile_id uuid,
  target_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  membership_id uuid;
  primary_owner_id uuid;
begin
  caller_role := public.brand_membership_role(target_brand_id);

  if target_role not in ('admin', 'contributor') then
    raise exception 'invalid_role';
  end if;

  if caller_role = 'owner' then
    null;
  elsif caller_role = 'admin' and target_role = 'contributor' then
    null;
  else
    raise exception 'brand_permission_denied';
  end if;

  select b.owner_id into primary_owner_id
    from public.brands b
   where b.id = target_brand_id;

  if primary_owner_id is null then
    raise exception 'brand_not_found';
  end if;
  if target_profile_id = primary_owner_id then
    raise exception 'owner_protected';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise exception 'profile_not_found';
  end if;

  begin
    insert into public.brand_memberships (brand_id, profile_id, role)
    values (target_brand_id, target_profile_id, target_role)
    returning id into membership_id;
  exception
    when unique_violation then
      raise exception 'duplicate_member';
  end;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, new_role
  )
  values (
    target_brand_id, auth.uid(), target_profile_id, 'member_added', target_role
  );

  return membership_id;
end;
$$;

create or replace function public.change_brand_member_role(
  target_membership_id uuid,
  target_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.brand_memberships%rowtype;
  caller_role text;
begin
  if target_role not in ('admin', 'contributor') then
    raise exception 'invalid_role';
  end if;

  select * into target_membership
    from public.brand_memberships m
   where m.id = target_membership_id;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  caller_role := public.brand_membership_role(target_membership.brand_id);
  if caller_role <> 'owner' then
    raise exception 'brand_permission_denied';
  end if;
  if target_membership.role = 'owner' then
    raise exception 'owner_protected';
  end if;
  if target_membership.role = target_role then
    return true;
  end if;

  update public.brand_memberships
     set role = target_role
   where id = target_membership.id;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, previous_role, new_role
  )
  values (
    target_membership.brand_id,
    auth.uid(),
    target_membership.profile_id,
    'role_changed',
    target_membership.role,
    target_role
  );

  return true;
end;
$$;

create or replace function public.remove_brand_member(target_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.brand_memberships%rowtype;
  caller_role text;
begin
  select * into target_membership
    from public.brand_memberships m
   where m.id = target_membership_id;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;
  if target_membership.role = 'owner' then
    raise exception 'owner_protected';
  end if;

  caller_role := public.brand_membership_role(target_membership.brand_id);
  if target_membership.profile_id = auth.uid() then
    null;
  elsif caller_role = 'owner' then
    null;
  elsif caller_role = 'admin' and target_membership.role = 'contributor' then
    null;
  else
    raise exception 'brand_permission_denied';
  end if;

  delete from public.brand_memberships where id = target_membership.id;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, previous_role
  )
  values (
    target_membership.brand_id,
    auth.uid(),
    target_membership.profile_id,
    'member_removed',
    target_membership.role
  );

  return true;
end;
$$;

revoke execute on function public.add_brand_member(uuid, uuid, text) from anon, public;
revoke execute on function public.change_brand_member_role(uuid, text) from anon, public;
revoke execute on function public.remove_brand_member(uuid) from anon, public;
grant execute on function public.add_brand_member(uuid, uuid, text) to authenticated;
grant execute on function public.change_brand_member_role(uuid, text) to authenticated;
grant execute on function public.remove_brand_member(uuid) to authenticated;

-- Person-authored content stays author-only. Brand managers may manage any row
-- attributed to their brand. Contributors retain only their human-author rights.
drop policy "own update posts" on public.posts;
create policy "own or managed brand update posts" on public.posts
for update to authenticated
using (
  author_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
)
with check (
  author_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
);

drop policy "own update listings" on public.listings;
create policy "own or managed brand update listings" on public.listings
for update to authenticated
using (
  seller_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
)
with check (
  seller_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
);

drop policy "own delete posts" on public.posts;
create policy "own or managed brand delete posts" on public.posts
for delete to authenticated
using (
  author_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
);

create or replace function public.soft_delete_managed_listing(target_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.listings as l
     set deleted_at = now()
   where l.id = target_listing_id
     and l.deleted_at is null
     and (
       l.seller_id = auth.uid()
       or (
         l.posting_as_type = 'brand'
         and l.brand_id is not null
         and public.is_brand_manager(l.brand_id)
       )
     );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke execute on function public.soft_delete_managed_listing(uuid) from anon, public;
grant execute on function public.soft_delete_managed_listing(uuid) to authenticated;
