-- Roll back Phase 7 brand RBAC to the Phase 6 owner-only behavior.
-- WARNING: non-owner memberships and membership audit events created after
-- Phase 7 are deleted. Export them before rollback if they must be preserved.

drop policy "own or managed brand update posts" on public.posts;
create policy "own update posts" on public.posts
for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy "own or managed brand update listings" on public.listings;
create policy "own update listings" on public.listings
for update to authenticated
using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));

drop policy "own or managed brand delete posts" on public.posts;
create policy "own delete posts" on public.posts
for delete to authenticated
using (author_id = (select auth.uid()));

drop function public.soft_delete_managed_listing(uuid);
drop function public.add_brand_member(uuid, uuid, text);
drop function public.change_brand_member_role(uuid, text);
drop function public.remove_brand_member(uuid);

drop policy "managers read membership events" on public.brand_membership_events;
drop table public.brand_membership_events;

delete from public.brand_memberships where role <> 'owner';

drop policy "read accessible brand memberships" on public.brand_memberships;
create policy "read own memberships" on public.brand_memberships
for select to authenticated
using (profile_id = (select auth.uid()));

drop policy "own insert memberships" on public.brand_memberships;
create policy "own insert memberships" on public.brand_memberships
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
      from public.brands b
     where b.id = brand_id
       and b.owner_id = (select auth.uid())
  )
);

drop function public.is_brand_manager(uuid);
drop function public.is_brand_member(uuid);
drop function public.brand_membership_role(uuid);

alter table public.brand_memberships
  drop constraint brand_memberships_role_check;
