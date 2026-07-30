-- Sweep for the whole defect class found via 20260730095309.
--
-- Three INSERT policies enforced a row cap by counting the very table the
-- policy guards. Postgres rejects that with
--
--   42P17 infinite recursion detected in policy for relation "<table>"
--
-- on every insert, so each cap made its table permanently un-writable rather
-- than merely capped. listing_photos was fixed in 20260730095309; a catalog
-- audit for `FROM <own table>` inside a policy expression found the remaining
-- two, both predating it:
--
--   saved_searches "own insert saved searches"  (cap 20) — nobody could ever
--     save a search, so the saved-search alerts built on top were dead.
--   brand_gallery  "managers insert gallery"    (cap 12) — no brand could ever
--     add a gallery image.
--
-- Same remedy as listing_photo_count: a SECURITY DEFINER counter reads the
-- table with the policy suspended, so the cap is enforced without the policy
-- re-entering itself. The caps themselves are unchanged.

create or replace function public.saved_search_count(target_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.saved_searches
   where profile_id = target_profile;
$$;

drop policy if exists "own insert saved searches" on public.saved_searches;

create policy "own insert saved searches" on public.saved_searches
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and public.saved_search_count((select auth.uid())) < 20
);

create or replace function public.brand_gallery_count(target_brand uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.brand_gallery
   where brand_id = target_brand;
$$;

drop policy if exists "managers insert gallery" on public.brand_gallery;

create policy "managers insert gallery" on public.brand_gallery
for insert to authenticated
with check (
  public.is_brand_manager(brand_id)
  and public.brand_gallery_count(brand_id) < 12
);
