-- Rollback for phase5-brands-attribution.sql
-- Existing posts/listings rows are untouched (new columns are nullable/defaulted additions).

drop policy if exists "own insert posts" on public.posts;
create policy "own insert posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
  for insert to authenticated with check (seller_id = auth.uid());

alter table public.posts
  drop column if exists posting_as_type,
  drop column if exists brand_id,
  drop column if exists about_type,
  drop column if exists about_id;

alter table public.listings
  drop column if exists posting_as_type,
  drop column if exists brand_id,
  drop column if exists about_type,
  drop column if exists about_id;

drop table if exists public.brand_memberships;
drop table if exists public.brands;

drop type if exists brand_type;
drop type if exists about_type;
drop type if exists posting_as_type;
