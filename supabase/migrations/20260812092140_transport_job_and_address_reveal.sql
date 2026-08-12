-- Step 3: the driver's job, and when they are allowed to see where to go.
--
-- Orders carry pickup_region and delivery_region — enough to verify coverage,
-- nowhere near enough to drive to. There were no addresses at all.
--
-- ADDRESSES ARE NOT COLUMN-READABLE BY ANYONE. Column grants cannot express
-- "only after the money is captured", because that is a row-level condition on a
-- column-level permission. So the columns are revoked from both client roles
-- outright and reached only through definers that check both WHO is asking and
-- WHERE the order is. Same shape as the handover code, and for the same reason:
-- the safest column is one no client can select.
--
-- WHY THE REVEAL WAITS FOR CAPTURE. An unconfirmed job must not leak a seller's
-- home address. People breed at home, the address is where their animals live,
-- and a browsing stranger who can name a booking should not be able to harvest
-- it. Waiting for `funds_held` costs a real driver nothing — they cannot start
-- before the money is captured anyway, because pickup requires it.

alter table public.orders
  add column if not exists pickup_address text,
  add column if not exists delivery_address text,
  add column if not exists pickup_contact text,
  add column if not exists delivery_contact text;

-- Revoke, then re-grant the readable allowlist. A column-level REVOKE against a
-- table-level grant is a silent no-op — it has shipped that way twice in this
-- project — so the order here is load-bearing.
revoke select on public.orders from anon, authenticated;
grant select (
  id, buyer_id, seller_id, listing_id, title_snapshot,
  amount_cents, deposit_cents, transport_cents, currency,
  buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
  buyer_fee_credit_cents, seller_fee_credit_cents,
  settled_buyer_fee_cents, settled_seller_fee_cents, remedy_cents,
  status, fulfilment, transporter_id,
  carrier, tracking_number, shipped_at, delivered_at,
  dispatched_at, picked_up_at, handover_at, animal_returned_at,
  inspection_hours, inspection_ends_at,
  settlement_branch, refund_price_cents, refund_deposit_cents, refund_transport_cents,
  pickup_region, delivery_region,
  created_at, updated_at
) on public.orders to authenticated;

/**
 * The seller says where to collect; the buyer says where to deliver. Neither can
 * write the other's, because an address is the one field where being wrong sends
 * a live animal to a stranger's door.
 */
create or replace function public.set_order_addresses(
  target_order uuid,
  pickup text default null,
  pickup_phone text default null,
  delivery text default null,
  delivery_phone text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.status in ('released','refunded','cancelled') then raise exception 'order_closed'; end if;

  if uid = o.seller_id then
    update public.orders set
      pickup_address = coalesce(nullif(btrim(pickup), ''), pickup_address),
      pickup_contact = coalesce(nullif(btrim(pickup_phone), ''), pickup_contact),
      updated_at = now()
    where id = target_order;
  elsif uid = o.buyer_id then
    update public.orders set
      delivery_address = coalesce(nullif(btrim(delivery), ''), delivery_address),
      delivery_contact = coalesce(nullif(btrim(delivery_phone), ''), delivery_contact),
      updated_at = now()
    where id = target_order;
  else
    raise exception 'not_a_party';
  end if;
end; $fn$;
revoke execute on function public.set_order_addresses(uuid, text, text, text, text) from anon, public;
grant execute on function public.set_order_addresses(uuid, text, text, text, text) to authenticated;

/**
 * A party's own view of the addresses. Buyer and seller both need to see what
 * was entered — a seller who cannot re-read their own pickup address cannot
 * correct a typo in it.
 */
create or replace function public.order_addresses(target_order uuid)
returns table (pickup_address text, pickup_contact text, delivery_address text, delivery_contact text)
language sql stable security definer set search_path = public as $fn$
  select o.pickup_address, o.pickup_contact, o.delivery_address, o.delivery_contact
    from public.orders o
   where o.id = target_order
     and (select auth.uid()) in (o.buyer_id, o.seller_id);
$fn$;
revoke execute on function public.order_addresses(uuid) from anon, public;
grant execute on function public.order_addresses(uuid) to authenticated;

/**
 * The driver's job list.
 *
 * Addresses and phone numbers are NULL until the money is captured. The job is
 * visible before then — a driver should know work is coming — but where the
 * animal lives is not part of "work is coming".
 *
 * `needs_code` tells the driver a code will be required at the door, without
 * revealing it: the code is the buyer's and the whole point is that the driver
 * cannot produce it alone.
 */
create or replace function public.my_transport_jobs()
returns table (
  order_id uuid,
  status text,
  title_snapshot text,
  seller_username text,
  buyer_username text,
  transport_cents integer,
  payout_status text,
  pickup_region text,
  delivery_region text,
  pickup_address text,
  pickup_contact text,
  delivery_address text,
  delivery_contact text,
  addresses_visible boolean,
  picked_up_at timestamptz,
  handover_at timestamptz,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $fn$
  select
    o.id, o.status, o.title_snapshot, s.username, b.username,
    o.transport_cents,
    (select p.status from public.order_payouts p
      where p.order_id = o.id and p.leg = 'transporter'
      order by p.created_at desc limit 1),
    o.pickup_region, o.delivery_region,
    case when o.status in ('funds_held','dispatched','inspection','disputed','released','refunded')
         then o.pickup_address end,
    case when o.status in ('funds_held','dispatched','inspection','disputed','released','refunded')
         then o.pickup_contact end,
    case when o.status in ('funds_held','dispatched','inspection','disputed','released','refunded')
         then o.delivery_address end,
    case when o.status in ('funds_held','dispatched','inspection','disputed','released','refunded')
         then o.delivery_contact end,
    o.status in ('funds_held','dispatched','inspection','disputed','released','refunded'),
    o.picked_up_at, o.handover_at, o.created_at
  from public.orders o
  left join public.profiles s on s.id = o.seller_id
  left join public.profiles b on b.id = o.buyer_id
  where o.transporter_id = (select auth.uid())
  order by o.created_at desc;
$fn$;
revoke execute on function public.my_transport_jobs() from anon, public;
grant execute on function public.my_transport_jobs() to authenticated;

-- A driver cannot take custody of an animal they have no address for.
create or replace function public.confirm_pickup(target_order uuid, scanned_anchor text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record; creature uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment <> 'transported' then raise exception 'not_a_transported_order'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'funds_held' then raise exception 'funds_not_held'; end if;
  if o.transporter_id is null then raise exception 'no_transporter'; end if;
  if o.delivery_address is null or btrim(o.delivery_address) = '' then
    raise exception 'delivery_address_required';
  end if;

  select l.creature_id into creature from public.listings l where l.id = o.listing_id;
  if creature is not null and exists (
    select 1 from public.creatures c where c.id = creature and c.anchor_value is not null
  ) then
    if not public.verify_creature_anchor(creature, scanned_anchor) then
      raise exception 'anchor_mismatch';
    end if;
  end if;

  update public.orders set
    status = 'dispatched', picked_up_at = now(), dispatched_at = now(), updated_at = now()
  where id = target_order;

  if o.transport_cents > 0 then
    perform public.record_order_payout(target_order, o.transporter_id, 'transporter', o.transport_cents, null);
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', 'anchor verified at pickup, custody to transporter');
end; $fn$;
revoke execute on function public.confirm_pickup(uuid, text) from anon, public;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;
