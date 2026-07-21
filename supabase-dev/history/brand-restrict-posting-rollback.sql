-- Rollback for 20260721151951_brand_restrict_posting. Documentation only.
-- Restores the any-member brand insert policies and drops the flag + RPC.

drop function if exists public.set_brand_posting_restriction(uuid, boolean);

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
    )
  )
);

alter table public.brands drop column if exists restrict_posting_to_managers;
