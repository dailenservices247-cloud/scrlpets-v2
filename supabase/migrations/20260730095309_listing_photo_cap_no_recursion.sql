-- Fixes a defect shipped in 20260730090429_listing_media_gallery.sql.
--
-- The "sellers insert listing photos" policy enforced the 10-photo cap with a
-- subquery against listing_photos — the very table the policy is attached to.
-- Postgres refuses that outright:
--
--   42P17 infinite recursion detected in policy for relation "listing_photos"
--
-- It is raised on every insert, so the gallery was un-writable through any
-- path (app code or raw API), not merely on multi-row inserts.
--
-- The rest of the schema already solves this with SECURITY DEFINER helpers
-- (is_brand_manager, is_animal_listable, verified_profile_ids) — a definer
-- function reads the table with the policy suspended, so the cap can be
-- checked without the policy re-entering itself. Same pattern here.

create or replace function public.listing_photo_count(target_listing uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.listing_photos
   where listing_id = target_listing;
$$;

drop policy if exists "sellers insert listing photos" on public.listing_photos;

create policy "sellers insert listing photos" on public.listing_photos
for insert to authenticated
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_photos.listing_id
      and l.deleted_at is null
      and (
        l.seller_id = (select auth.uid())
        or (l.brand_id is not null and public.is_brand_manager(l.brand_id))
      )
  )
  and public.listing_photo_count(listing_photos.listing_id) < 10
);
