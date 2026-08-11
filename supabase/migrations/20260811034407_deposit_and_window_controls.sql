-- Deposit and inspection window become things a seller sets, not constants.
--
-- `orders.deposit_cents` has existed since the money state machine and NOTHING
-- ever populated it — every deposit branch in the dispute policy was
-- adjudicating a number that was always zero. `inspection_hours` had the same
-- shape: a column with a default and no way for a seller to change it, while the
-- policy promised they could extend it.
--
-- Both live on the LISTING, because both are part of what the seller is
-- offering, and both are FROZEN onto the order at creation for the same reason
-- the fee rates are: a seller who edits their listing next week must not change
-- the terms of a sale already underway.
--
-- DEPOSIT AS BASIS POINTS, not an amount. A seller thinks in dollars and the UI
-- should show dollars, but storing a percentage means the 25% ceiling holds
-- automatically when a price changes. A stored amount would quietly become 60%
-- of the price the moment somebody discounted the animal.
--
-- WHY 25%. The deposit is a seller protection — they hold an animal off-market
-- on the strength of it, and §1 forfeits it when a buyer walks with no cause. But
-- uncapped, a seller could take 90% up front, at which point the buyer protection
-- the whole platform sells is gone: there is almost nothing left in escrow to
-- return. 25% is enough commitment to be real and small enough that the escrow
-- still does its job.
--
-- WHY 14 DAYS MAXIMUM. A longer window is generosity toward the buyer, so a
-- seller may extend it. The ceiling stops a seller "extending" to six months to
-- look generous while leaving their own money — and the buyer's — in limbo.

alter table public.listings
  add column if not exists deposit_bps integer not null default 0,
  add column if not exists inspection_hours integer not null default 24;

alter table public.listings drop constraint if exists listings_deposit_bps_check;
alter table public.listings add constraint listings_deposit_bps_check
  check (deposit_bps >= 0 and deposit_bps <= 2500);

alter table public.listings drop constraint if exists listings_inspection_hours_check;
alter table public.listings add constraint listings_inspection_hours_check
  check (inspection_hours >= 24 and inspection_hours <= 336);

grant select (deposit_bps, inspection_hours) on public.listings to anon, authenticated;
grant update (deposit_bps, inspection_hours) on public.listings to authenticated;

-- The order carries the same ceiling, so a hand-written order cannot exceed what
-- a listing could have offered.
alter table public.orders drop constraint if exists orders_inspection_max;
alter table public.orders add constraint orders_inspection_max
  check (inspection_hours <= 336);

create or replace function public.create_order(target_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  oid uuid;
  b_bps integer; s_bps integer; b_fee integer; s_fee integer; dep integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into l from public.listings where id = target_listing and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.seller_id = uid then raise exception 'cannot_buy_own_listing'; end if;
  if l.availability <> 'available' then raise exception 'listing_unavailable'; end if;
  if l.price_cents <= 0 then raise exception 'listing_not_priced'; end if;

  if l.creature_id is not null then
    if not public.is_verified_seller(l.seller_id) then raise exception 'seller_not_verified'; end if;
    if not public.is_animal_listable(l.creature_id) then raise exception 'animal_not_listable'; end if;
    if l.price_cents >= public.buyer_verification_threshold_cents()
       and not public.is_identity_verified(uid) then
      raise exception 'buyer_verification_required';
    end if;
  end if;

  if not public.can_receive_payouts(l.seller_id) then raise exception 'seller_cannot_receive_payouts'; end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(l.seller_id);
  b_fee := least(round(l.price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(l.price_cents * s_bps / 10000.0)::integer;
  -- A PORTION of the price, never an addition — order_due_cents depends on it.
  dep := round(l.price_cents * coalesce(l.deposit_bps, 0) / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, listing_id, title_snapshot, amount_cents, currency,
    buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
    deposit_cents, inspection_hours
  )
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency,
          b_bps, s_bps, b_fee, s_fee,
          dep, greatest(coalesce(l.inspection_hours, 24), 24))
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft',
          'order created; buyer ' || b_bps || 'bps=' || b_fee ||
          ', seller ' || s_bps || 'bps=' || s_fee ||
          ', deposit=' || dep || ', inspection=' || greatest(coalesce(l.inspection_hours, 24), 24) || 'h');
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid) from anon, public;
grant execute on function public.create_order(uuid) to authenticated;
