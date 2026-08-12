-- Step 2: a buyer books transport as part of the purchase.
--
-- RULED: transport is booked INSIDE checkout. It is the only shape where "the
-- transporter is always paid" is structurally true rather than a promise,
-- because the platform is holding the money at the moment the obligation
-- arises. Booked alongside, a buyer who refuses at the door leaves the driver
-- chasing an invoice.
--
-- RULED: the seller may RECOMMEND, never require. The buyer pays, and a required
-- transporter is a kickback channel. The recommendation is stored on the listing
-- and carries no fee, no priority and no default — it is a suggestion, labelled
-- as the seller's.
--
-- NOTE ON THE SIGNATURE. create_order gains a parameter, and CREATE OR REPLACE
-- with a different parameter count creates a SECOND function rather than
-- replacing the first — which is how guide authoring broke in this project with
-- `42725 function is not unique`. The old one-argument version is dropped
-- explicitly at the end, after the new one exists.

alter table public.listings
  add column if not exists recommended_transport_service_id uuid
    references public.services(id) on delete set null;
grant select (recommended_transport_service_id) on public.listings to anon, authenticated;
grant update (recommended_transport_service_id) on public.listings to authenticated;

-- The route, so coverage can be verified server-side rather than trusted from
-- whatever the checkout page happened to send.
alter table public.orders
  add column if not exists pickup_region text,
  add column if not exists delivery_region text;

alter table public.orders drop constraint if exists orders_region_format;
alter table public.orders add constraint orders_region_format check (
  (pickup_region is null or pickup_region ~ '^[A-Z]{2}$')
  and (delivery_region is null or delivery_region ~ '^[A-Z]{2}$')
);

-- A transported order without a route is one nobody can verify coverage for.
alter table public.orders drop constraint if exists orders_transported_needs_route;
alter table public.orders add constraint orders_transported_needs_route check (
  fulfilment <> 'transported'
  or (pickup_region is not null and delivery_region is not null)
);

grant select (pickup_region, delivery_region) on public.orders to authenticated;

create or replace function public.create_order(
  target_listing uuid,
  transport_service uuid default null,
  pickup_region text default null,
  delivery_region text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  svc record;
  oid uuid;
  b_bps integer; s_bps integer; b_fee integer; s_fee integer; dep integer;
  hauler uuid; transport integer := 0; mode text := 'in_person';
  from_r text := upper(btrim(coalesce(pickup_region, '')));
  to_r text := upper(btrim(coalesce(delivery_region, '')));
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

  -- ---------------------------------------------------------------- transport
  if transport_service is not null then
    select * into svc from public.services where id = transport_service and active;
    if svc is null then raise exception 'transport_service_not_found'; end if;
    if svc.category <> 'transport' then raise exception 'not_a_transport_service'; end if;

    -- Both gates, re-checked HERE and not inherited from whatever the checkout
    -- page believed. An approved transporter who lost their payout account
    -- between browsing and buying must not be bookable.
    if not public.can_transport(svc.owner_id) then raise exception 'transporter_not_bookable'; end if;
    if svc.owner_id = uid or svc.owner_id = l.seller_id then
      raise exception 'transporter_cannot_be_a_party';
    end if;

    if from_r = '' or to_r = '' then raise exception 'route_required'; end if;
    -- Coverage verified server-side. The UI offers only covered transporters,
    -- but a booking that has to be cancelled is worse than one refused now.
    if not exists (select 1 from public.transport_coverage c
                    where c.service_id = svc.id and c.region_code = from_r)
       or not exists (select 1 from public.transport_coverage c
                       where c.service_id = svc.id and c.region_code = to_r) then
      raise exception 'route_not_covered';
    end if;

    hauler := svc.owner_id;
    transport := coalesce(svc.price_cents, 0);
    mode := 'transported';
  end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(l.seller_id);
  -- The platform's cut is on the ANIMAL, never on the transporter's fee. Taking
  -- a percentage of somebody else's service is a fee on a third party who never
  -- agreed to it.
  b_fee := least(round(l.price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(l.price_cents * s_bps / 10000.0)::integer;
  dep := round(l.price_cents * coalesce(l.deposit_bps, 0) / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, listing_id, title_snapshot, amount_cents, currency,
    buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
    deposit_cents, inspection_hours,
    fulfilment, transporter_id, transport_cents,
    pickup_region, delivery_region
  )
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency,
          b_bps, s_bps, b_fee, s_fee,
          dep, greatest(coalesce(l.inspection_hours, 24), 24),
          mode, hauler, transport,
          nullif(from_r, ''), nullif(to_r, ''))
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft',
          'order created; buyer ' || b_bps || 'bps=' || b_fee ||
          ', seller ' || s_bps || 'bps=' || s_fee ||
          ', deposit=' || dep ||
          case when hauler is null then '' else ', transport=' || transport || ' ' || from_r || '->' || to_r end);
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid, uuid, text, text) from anon, public;
grant execute on function public.create_order(uuid, uuid, text, text) to authenticated;

-- Dropped LAST and explicitly. Left in place it would be a second candidate for
-- create_order(uuid) and every existing one-argument call would fail as
-- ambiguous — the 42725 that broke guide authoring here once already.
drop function if exists public.create_order(uuid);
