-- Per-brand restrict-posting (entity-authority spec decision 1, mini-slice).
-- Owner/admin can restrict posting-as-brand to admin+owner. Default false =
-- existing any-member behavior, so this is backward-compatible.

alter table public.brands
  add column if not exists restrict_posting_to_managers boolean not null default false;

-- Row 3 insert gate: still a member, but when the brand is restricted the member
-- must also be a manager. Contributors are blocked only on restricted brands.
drop policy if exists "own insert posts" on public.posts;
create policy "own insert posts" on public.posts
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    posting_as_type = 'person'
    or (
      posting_as_type = 'brand'
      and brand_id is not null
      and exists (
        select 1 from public.brand_memberships m
        where m.brand_id = posts.brand_id and m.profile_id = (select auth.uid())
      )
      and (
        public.is_brand_manager(brand_id)
        or not exists (
          select 1 from public.brands b
          where b.id = posts.brand_id and b.restrict_posting_to_managers
        )
      )
    )
  )
);

drop policy if exists "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and (
    posting_as_type = 'person'
    or (
      posting_as_type = 'brand'
      and brand_id is not null
      and exists (
        select 1 from public.brand_memberships m
        where m.brand_id = listings.brand_id and m.profile_id = (select auth.uid())
      )
      and (
        public.is_brand_manager(brand_id)
        or not exists (
          select 1 from public.brands b
          where b.id = listings.brand_id and b.restrict_posting_to_managers
        )
      )
    )
  )
);

-- The flag is written ONLY through this manager-gated definer RPC; brands has no
-- direct UPDATE policy (mirrors the member-management RPCs).
create or replace function public.set_brand_posting_restriction(
  target_brand_id uuid,
  restrict boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brand_manager(target_brand_id) then
    raise exception 'brand_permission_denied';
  end if;
  update public.brands
     set restrict_posting_to_managers = restrict
   where id = target_brand_id;
  return true;
end;
$$;

revoke execute on function public.set_brand_posting_restriction(uuid, boolean) from anon, public;
grant execute on function public.set_brand_posting_restriction(uuid, boolean) to authenticated;
