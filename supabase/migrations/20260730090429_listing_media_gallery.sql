-- Phase C.1 — listing photo galleries (V2-01) + service photos (V3-05).
--
-- Listings carry a single `media_url` today. A live-animal listing is a
-- high-trust purchase decision made largely on photographs, so one image is
-- the wrong primitive: buyers want the animal from several angles, and the
-- legacy app's own listing page (its most complete surface) was built around
-- a gallery with captions.
--
-- Existing `media_url` stays as the cover so nothing already published
-- changes; the gallery is additive and the cover is simply display_order 0.

create table if not exists public.listing_photos (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  photo_url text not null,
  caption text,
  display_order integer not null default 0,
  created_at timestamptz default now() not null,
  constraint listing_photos_pkey primary key (id),
  constraint listing_photos_caption_check
    check (caption is null or length(caption) <= 150)
);
create index if not exists idx_listing_photos_listing
  on public.listing_photos using btree (listing_id, display_order);

alter table public.listing_photos enable row level security;

-- Photos are as public as the listing they belong to: the SELECT policy defers
-- to the listing, so a soft-deleted listing takes its gallery with it.
create policy "read photos of visible listings" on public.listing_photos
for select to anon, authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_photos.listing_id and l.deleted_at is null
  )
);

-- Writes follow the same author-or-brand-manager authority as the listing
-- itself (matrix rows 6/7), and the DB caps the gallery at 10.
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
  and (
    select count(*) from public.listing_photos p
     where p.listing_id = listing_photos.listing_id
  ) < 10
);

create policy "sellers update listing photos" on public.listing_photos
for update to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_photos.listing_id
      and (
        l.seller_id = (select auth.uid())
        or (l.brand_id is not null and public.is_brand_manager(l.brand_id))
      )
  )
);

create policy "sellers delete listing photos" on public.listing_photos
for delete to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_photos.listing_id
      and (
        l.seller_id = (select auth.uid())
        or (l.brand_id is not null and public.is_brand_manager(l.brand_id))
      )
  )
);

-- V3-05: one photo on a service listing. A groomer's portfolio shot is the
-- difference between a listing and a classified ad; a full gallery here would
-- be scope the services surface has not earned yet.
alter table public.services
  add column if not exists media_url text;
