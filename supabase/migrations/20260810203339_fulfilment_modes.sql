-- Step 3: release is a property of HOW THE ANIMAL MOVES, not one global rule.
--
-- The 2026-08-04 machine assumed one shape: a seller and a buyer meeting, the
-- seller typing a code and scanning the animal. That is one of three real
-- situations, and the other two were unreachable:
--
--   in_person    buyer meets the seller           code + anchor, SELLER enters
--   transported  a third party delivers           code + anchor, TRANSPORTER enters
--   shipped      a carrier delivers a box         tracking + live-arrival window
--
-- SHIPPED is not an edge case. Reptiles, inverts and fish are genuinely bought
-- this way, and they carry no microchip and no leg band — their assurance level
-- is already `declared`. Demanding an anchor scan there would be pretending to
-- verify something nobody can verify. For those the SHIPMENT is the evidence.
-- Until this migration a shipped order could never leave `dispatched`, because
-- the only route onward required a meeting that never happens.
--
-- TRANSPORTED changes WHO confirms. The seller is not present at the delivery —
-- that is the entire point of hiring transport. Keeping `uid = seller_id` would
-- have forced the one party who is provably absent to attest that the handover
-- happened, which is worse than useless: it is an attestation the seller cannot
-- honestly make.

alter table public.orders
  add column if not exists fulfilment text not null default 'in_person',
  add column if not exists transporter_id uuid references public.profiles(id) on delete restrict,
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders drop constraint if exists orders_fulfilment_check;
alter table public.orders add constraint orders_fulfilment_check
  check (fulfilment = any (array['in_person','transported','shipped']));

-- Money owed to a transporter who does not exist can never be paid, and the
-- dispute policy promises the transporter is paid in every branch.
alter table public.orders drop constraint if exists orders_transport_needs_transporter;
alter table public.orders add constraint orders_transport_needs_transporter
  check (transport_cents = 0 or transporter_id is not null);

grant select (fulfilment, transporter_id, carrier, tracking_number, shipped_at, delivered_at)
  on public.orders to authenticated;

/**
 * Who may attest that the handover happened. The seller when they are there,
 * the transporter when they are the one at the door. Never the buyer: the buyer
 * holds the code, and a party who could both hold the code and confirm its
 * entry has not proved anything.
 */
create or replace function public.is_handover_agent(target_order uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.orders o
     where o.id = target_order
       and case o.fulfilment
             when 'in_person'   then who = o.seller_id
             when 'transported' then who = o.transporter_id
             else false            -- shipped has no handover agent at all
           end
  );
$fn$;
revoke execute on function public.is_handover_agent(uuid, uuid) from anon, public;
grant execute on function public.is_handover_agent(uuid, uuid) to authenticated;

/**
 * Code + anchor, now for BOTH meeting modes and refused outright for shipped.
 *
 * Unchanged and still load-bearing: a code mismatch and an anchor mismatch raise
 * DIFFERENT errors, because an anchor mismatch is §3 (wrong animal, seller's
 * fault, automatic account review) and must never be indistinguishable from a
 * mistyped code.
 */
create or replace function public.confirm_handover_and_hold(
  target_order uuid, entered_code text, scanned_anchor text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record; creature uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;

  -- A shipped order has no meeting. Releasing it this way would fabricate a
  -- handover that never occurred, so it is refused rather than quietly allowed.
  if o.fulfilment = 'shipped' then raise exception 'shipped_orders_confirm_by_delivery'; end if;
  if not public.is_handover_agent(target_order, uid) then raise exception 'not_the_handover_agent'; end if;
  if o.status <> 'dispatched' then raise exception 'not_dispatched'; end if;

  if public.normalise_anchor(entered_code) is distinct from public.normalise_anchor(o.handover_code)
  then raise exception 'code_mismatch'; end if;

  select l.creature_id into creature from public.listings l where l.id = o.listing_id;

  if creature is not null and exists (
    select 1 from public.creatures c where c.id = creature and c.anchor_value is not null
  ) then
    if not public.verify_creature_anchor(creature, scanned_anchor) then
      raise exception 'anchor_mismatch';
    end if;
  end if;

  update public.orders set
    status = 'inspection',
    handover_at = now(),
    inspection_ends_at = now() + make_interval(hours => o.inspection_hours),
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'inspection', 'code and anchor verified');
end; $fn$;
revoke execute on function public.confirm_handover_and_hold(uuid, text, text) from anon, public;
grant execute on function public.confirm_handover_and_hold(uuid, text, text) to authenticated;

-- ============================================================ THE SHIPPED PATH
/**
 * The seller hands the box to a carrier. This is the shipped equivalent of
 * mark_dispatched and carries the same capture-before-dispatch invariant: it is
 * reachable only from `funds_held`, which now means fully captured.
 *
 * A tracking number is REQUIRED. Without one there is no evidence the animal was
 * ever sent, and "no tracking number was ever entered" is precisely how §2
 * distinguishes a seller who never shipped from a carrier who lost the parcel.
 */
create or replace function public.record_shipment(
  target_order uuid, ship_carrier text, tracking text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if tracking is null or btrim(tracking) = '' then raise exception 'tracking_required'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment <> 'shipped' then raise exception 'not_a_shipped_order'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'funds_held' then raise exception 'funds_not_held'; end if;

  update public.orders set
    status = 'dispatched', carrier = ship_carrier, tracking_number = btrim(tracking),
    shipped_at = now(), dispatched_at = now(), updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', 'shipped: ' || coalesce(ship_carrier, '?') || ' ' || btrim(tracking));
end; $fn$;
revoke execute on function public.record_shipment(uuid, text, text) from anon, public;
grant execute on function public.record_shipment(uuid, text, text) to authenticated;

/**
 * The carrier says it arrived. Service-role only — this is the carrier's
 * assertion, not the seller's, and a seller who could declare their own parcel
 * delivered would start the release clock on an animal still in a van.
 *
 * Starts the live-arrival window. The window governs only WHEN funds release; it
 * is NOT the seller's live-arrival guarantee, which is their own published
 * document and is adjudicated under §4.
 */
create or replace function public.confirm_shipment_delivered(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare o record;
begin
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment <> 'shipped' then raise exception 'not_a_shipped_order'; end if;
  if o.status <> 'dispatched' then raise exception 'not_dispatched'; end if;

  update public.orders set
    status = 'inspection', delivered_at = now(), handover_at = now(),
    inspection_ends_at = now() + make_interval(hours => o.inspection_hours),
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, null, o.status, 'inspection', 'carrier confirmed delivery');
end; $fn$;
revoke execute on function public.confirm_shipment_delivered(uuid) from anon, authenticated, public;

/**
 * Shipped orders whose carrier never confirmed delivery. RULED 2026-08-10: 14
 * days after the ship date routes to dispute.
 *
 * Deliberately NOT auto-settled. The two causes look identical from here and
 * settle differently — a seller who never shipped is §2 `no_show_seller`, while a
 * parcel lost in transit is nobody's fault, refunds the buyer in full, and
 * leaves the carrier claim with the seller because they are the shipper who
 * holds that contract. Only a human can tell those apart.
 */
create or replace function public.overdue_shipments()
returns table (order_id uuid, shipped_at timestamptz, carrier text, tracking_number text)
language sql stable security definer set search_path = public as $fn$
  select o.id, o.shipped_at, o.carrier, o.tracking_number
    from public.orders o
   where o.fulfilment = 'shipped'
     and o.status = 'dispatched'
     and o.shipped_at is not null
     and o.shipped_at < now() - interval '14 days';
$fn$;
revoke execute on function public.overdue_shipments() from anon, authenticated, public;

/**
 * mark_dispatched is now the MEETING path only. A shipped order must go through
 * record_shipment so a tracking number exists — otherwise it could reach
 * `dispatched` with no evidence it was ever sent, and §2 could not tell a seller
 * who never shipped from a carrier who lost the parcel.
 */
create or replace function public.mark_dispatched(target_order uuid, note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment = 'shipped' then raise exception 'use_record_shipment'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'funds_held' then raise exception 'funds_not_held'; end if;

  update public.orders set status = 'dispatched', dispatched_at = now(), updated_at = now()
   where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', note);
end; $fn$;
revoke execute on function public.mark_dispatched(uuid, text) from anon, public;
grant execute on function public.mark_dispatched(uuid, text) to authenticated;

create index if not exists idx_orders_overdue_shipments
  on public.orders (shipped_at) where fulfilment = 'shipped' and status = 'dispatched';
