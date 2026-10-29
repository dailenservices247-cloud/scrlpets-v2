-- Migration: Catalog Inventory & Bulk Ingestion for Companies & Independents
-- Adds stock tracking, shipping fee, and fulfillment options to listings.

alter table public.listings
  add column if not exists stock_quantity integer
    check (stock_quantity is null or stock_quantity >= 0),
  add column if not exists shipping_fee_cents integer not null default 0
    check (shipping_fee_cents >= 0),
  add column if not exists fulfillment_options text[] not null default array['shipping']::text[];

grant select (stock_quantity, shipping_fee_cents, fulfillment_options)
  on public.listings to anon, authenticated;

grant update (stock_quantity, shipping_fee_cents, fulfillment_options)
  on public.listings to authenticated;
