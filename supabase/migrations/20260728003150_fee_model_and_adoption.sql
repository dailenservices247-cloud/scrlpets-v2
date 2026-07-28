-- D12 fee model + R17 adoption/rehoming.

-- ==================================================== D12 — THE FEE MODEL
-- Decided 2026-07-27: a PERCENTAGE of each completed sale, paid by the SELLER,
-- with NO seller tiers. Legacy's `seller_tier` is not coming back.
--
-- The model is settled; the RATE is not. fee_bps stays 0 until Dailen names a
-- number, so orders continue to record a zero fee rather than a made-up one.
alter table public.platform_flags add column if not exists value_int integer;

insert into public.platform_flags (key, enabled, value_int)
values ('fee_bps', true, 0)
on conflict (key) do nothing;

create or replace function public.fee_bps()
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce((select value_int from public.platform_flags where key = 'fee_bps'), 0);
$fn$;

create or replace function public.create_order(target_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  oid uuid;
  fee integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into l from public.listings where id = target_listing and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.seller_id = uid then raise exception 'cannot_buy_own_listing'; end if;
  if l.availability <> 'available' then raise exception 'listing_unavailable'; end if;
  if l.price_cents <= 0 then raise exception 'listing_not_priced'; end if;

  -- The Phase 2 gate applies to money exactly as it applies to publication,
  -- and to adoption exactly as it applies to sale.
  if l.creature_id is not null then
    if not public.is_verified_seller(l.seller_id) then raise exception 'seller_not_verified'; end if;
    if not public.is_animal_listable(l.creature_id) then raise exception 'animal_not_listable'; end if;
  end if;

  -- D12: percentage of sale, seller-paid. Rounds to whole cents.
  fee := round(l.price_cents * public.fee_bps() / 10000.0);

  insert into public.orders (
    buyer_id, seller_id, listing_id, title_snapshot,
    amount_cents, currency, fee_cents, fee_payer
  )
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency, fee, 'seller')
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft', 'order created');
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid) from anon, public;
grant execute on function public.create_order(uuid) to authenticated;

-- ============================================ R17 — ADOPTION / REHOMING
-- An adoption is a listing whose intent is placement rather than sale. It is
-- deliberately the SAME entity under the SAME gate: a weaker gate for
-- "free to a good home" would be a bypass, and that phrase is exactly where
-- animal scams live. Adoption fees are allowed (they cover vetting), so the
-- price may be zero or positive.
alter table public.listings
  add column if not exists listing_kind text not null default 'sale';

do $$ begin
  alter table public.listings add constraint listings_kind_check
    check (listing_kind = any (array['sale','adoption']));
exception when duplicate_object then null; end $$;

-- Rehoming is about animals; a product cannot be an adoption.
do $$ begin
  alter table public.listings add constraint listings_adoption_needs_animal
    check (listing_kind = 'sale' or creature_id is not null);
exception when duplicate_object then null; end $$;

create index if not exists idx_listings_adoption
  on public.listings using btree (created_at desc)
  where listing_kind = 'adoption' and deleted_at is null;

-- The shop browses products only; this keeps that true as kinds multiply.
create index if not exists idx_listings_sale_products
  on public.listings using btree (created_at desc)
  where listing_kind = 'sale' and creature_id is null and deleted_at is null;
