-- Migration: Bookable Service Packages, Deposits & Booking Notice
-- Empowers both independent providers and commercial facilities to offer
-- structured service menus, deposit requirements, and booking requests.

alter table public.services
  add column if not exists booking_enabled boolean not null default true,
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount_cents integer
    check (deposit_amount_cents is null or deposit_amount_cents >= 0),
  add column if not exists service_tier_rates jsonb not null default '[]'::jsonb,
  add column if not exists booking_notice text;

grant select (booking_enabled, deposit_required, deposit_amount_cents, service_tier_rates, booking_notice)
  on public.services to anon, authenticated;

grant update (booking_enabled, deposit_required, deposit_amount_cents, service_tier_rates, booking_notice)
  on public.services to authenticated;
