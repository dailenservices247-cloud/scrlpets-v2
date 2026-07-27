-- Rollback for Phase 4 (20260727192855 + 20260727193008).
drop function if exists public.advance_order(uuid, text, text);
drop function if exists public.create_order(uuid);
drop table if exists public.order_events;
drop table if exists public.orders;
drop function if exists public.is_flag_enabled(text);
drop table if exists public.platform_flags;
drop function if exists public.set_application_status(uuid, text);
drop table if exists public.buyer_applications;
drop index if exists public.idx_listings_shop;
alter table public.listings
  drop constraint if exists listings_availability_check,
  drop column if exists description,
  drop column if exists currency,
  drop column if exists category,
  drop column if exists availability;
