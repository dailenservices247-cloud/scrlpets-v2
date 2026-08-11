-- The scam this platform exists to stop, pointed the other way.
--
-- A refund never required the animal back. Buyer pays $2,000, animal is
-- delivered, buyer disputes inside the window, the claim is upheld, $2,000 goes
-- back — and NOTHING in the system asks for the dog. The seller loses the animal
-- AND the money.
--
-- It is one branch, and it is the branch where the buyer already has custody:
--
--   §1 refusal at the door      buyer never took the animal        safe
--   §2 nobody appears           never handed over                  safe
--   §3 wrong animal             anchor mismatch caught AT handover  safe
--   §4 health claim in-window   BUYER HAS THE ANIMAL               the hole
--
-- Two things were wrong. First, the inspection window was built as though it
-- were a returns period. It is not: its only job is "did the thing I paid for
-- actually arrive" — right anchor, alive, broadly as listed. A health problem
-- found afterwards is a GUARANTEE claim, and the remedy is whatever the seller
-- published. Real breeder contracts almost never say "keep the animal and take
-- your money back"; they say reimburse vet costs, replace, or refund ON RETURN.
--
-- Second, `guarantee_upheld` refunded everything unconditionally, which encoded
-- the one remedy no real contract offers. It is replaced by the three that
-- exist, and the refund-on-return branch REFUSES until the animal is recorded
-- back with the seller.
--
-- Also here, because both are custody questions: two-point verification (the
-- seller scans at pickup, the transporter enters the code at delivery — matched
-- to who actually owns a chip scanner), and transport paid on custody so a
-- journey that never started is refunded in full.

alter table public.orders
  add column if not exists picked_up_at timestamptz,
  add column if not exists animal_returned_at timestamptz,
  add column if not exists remedy_cents integer;

alter table public.orders drop constraint if exists orders_remedy_nonneg;
alter table public.orders add constraint orders_remedy_nonneg
  check (remedy_cents is null or remedy_cents >= 0);

grant select (picked_up_at, animal_returned_at, remedy_cents) on public.orders to authenticated;

alter table public.orders drop constraint if exists orders_settlement_branch_check;
alter table public.orders add constraint orders_settlement_branch_check check (
  settlement_branch is null or settlement_branch = any (array[
    'refusal_no_cause',           -- §1
    'no_show_buyer',              -- §2
    'no_show_seller',             -- §2
    'wrong_animal',               -- §3
    -- §4 remedies, named as real guarantees name them
    'guarantee_vet_costs',        -- reimburse the vet bill from held funds
    'guarantee_replacement',      -- seller supplies a replacement; funds release
    'guarantee_refund_on_return', -- full refund, ONLY once the animal is back
    'guarantee_not_covered',      -- the published terms do not cover it
    'guarantee_ambiguous',        -- contra proferentem — buyer's favour
    'seller_refund'
  ])
);

-- ==================================================== TWO-POINT CUSTODY
/**
 * PICKUP. The seller scans the anchor and releases the animal to the
 * transporter.
 *
 * The scan happens HERE and not at delivery for a plainly physical reason:
 * transporters do not carry microchip readers. Breeders often do, vets and
 * shelters do, drivers do not. Requiring a driver to scan at the door would
 * either stall every transported order or push everyone into pretending — which
 * is the exact failure the anchor exists to prevent.
 *
 * Splitting the two proofs across the journey is also STRONGER than asking one
 * party for both:
 *   pickup    the seller proves the RIGHT ANIMAL got in the van
 *   delivery  the buyer's code proves it reached the RIGHT PERSON
 * Three parties each attest to the link they can actually observe, and no one of
 * them can fake the chain alone.
 */
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

  -- The transporter is owed from the moment they take the animal. They are paid
  -- for the JOURNEY, not the outcome — a buyer refusing at the door is not the
  -- driver's problem. Recorded pending so the obligation is visible before the
  -- transfer is made.
  if o.transport_cents > 0 then
    perform public.record_order_payout(target_order, o.transporter_id, 'transporter', o.transport_cents, null);
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', 'anchor verified at pickup, custody to transporter');
end; $fn$;
revoke execute on function public.confirm_pickup(uuid, text) from anon, public;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;

/**
 * DELIVERY, transported mode. The code only — the anchor was proven at pickup
 * and the animal has been in one identified party's custody since.
 */
create or replace function public.confirm_delivery_with_code(target_order uuid, entered_code text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment <> 'transported' then raise exception 'not_a_transported_order'; end if;
  if uid is distinct from o.transporter_id then raise exception 'not_the_transporter'; end if;
  if o.status <> 'dispatched' then raise exception 'not_dispatched'; end if;
  if o.picked_up_at is null then raise exception 'never_picked_up'; end if;

  if public.normalise_anchor(entered_code) is distinct from public.normalise_anchor(o.handover_code)
  then raise exception 'code_mismatch'; end if;

  update public.orders set
    status = 'inspection', handover_at = now(),
    inspection_ends_at = now() + make_interval(hours => o.inspection_hours),
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'inspection', 'buyer code entered by transporter at delivery');
end; $fn$;
revoke execute on function public.confirm_delivery_with_code(uuid, text) from anon, public;
grant execute on function public.confirm_delivery_with_code(uuid, text) to authenticated;

/**
 * The animal is back with the seller. Recorded by the SELLER, because they are
 * the one who has to physically receive it — a buyer who could self-certify a
 * return would walk away with both the animal and the money, which is the entire
 * hole this migration closes.
 */
create or replace function public.confirm_animal_returned(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.animal_returned_at is not null then return; end if;

  update public.orders set animal_returned_at = now(), updated_at = now() where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, o.status, 'seller confirmed the animal is back');
end; $fn$;
revoke execute on function public.confirm_animal_returned(uuid) from anon, public;
grant execute on function public.confirm_animal_returned(uuid) to authenticated;

-- ============================================================== SETTLEMENT
/**
 * Adds the three §4 remedies that real guarantees actually offer, and refuses to
 * unwind a sale while the buyer still has the animal.
 *
 * TRANSPORT NOW FOLLOWS CUSTODY, NOT FAULT. If the journey never started
 * (`picked_up_at` is null) the transport money refunds in full in every branch —
 * nobody drove, nobody is owed, and the buyer never has to be told they lost it.
 * Once the animal is in the van the transporter is paid regardless of what
 * happens at the door.
 */
create or replace function public.settle_order(
  target_order uuid, branch text, note text default null, remedy integer default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  price integer; dep integer; trans integer;
  keep_b integer; keep_s integer;
  final_status text;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.status in ('released', 'refunded', 'cancelled') then raise exception 'already_settled'; end if;

  if branch = 'seller_refund' then
    if uid <> o.seller_id and not public.is_platform_admin() then raise exception 'not_permitted'; end if;
  elsif not public.is_platform_admin() then
    raise exception 'not_permitted';
  end if;

  -- The animal must be back before a sale is unwound. Without this the buyer
  -- keeps the animal and the money.
  if branch = 'guarantee_refund_on_return' and o.animal_returned_at is null then
    raise exception 'animal_not_returned';
  end if;

  case branch
    when 'refusal_no_cause'           then price := o.amount_cents; dep := 0;               trans := 0;
    when 'no_show_buyer'              then price := o.amount_cents; dep := 0;               trans := 0;
    when 'no_show_seller'             then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'wrong_animal'               then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'guarantee_refund_on_return' then price := o.amount_cents; dep := o.deposit_cents; trans := 0;
    when 'guarantee_ambiguous'        then price := o.amount_cents; dep := o.deposit_cents; trans := 0;
    -- Vet costs come out of held funds, capped at the price. The animal STAYS
    -- with the buyer, so the rest of the sale completes.
    when 'guarantee_vet_costs'        then price := least(coalesce(remedy, 0), o.amount_cents);
                                           dep := 0; trans := 0;
    -- A replacement is an obligation between the parties, not a refund. Funds
    -- release; the platform does not hold money against a future litter.
    when 'guarantee_replacement'      then price := 0; dep := 0; trans := 0;
    when 'guarantee_not_covered'      then price := 0; dep := 0; trans := 0;
    when 'seller_refund'              then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    else raise exception 'unknown_branch';
  end case;

  -- Transport follows custody. A journey that never started is always refunded;
  -- one that started is always earned.
  if o.picked_up_at is null then
    trans := o.transport_cents;
  elsif branch not in ('no_show_seller') then
    trans := 0;
  end if;

  if branch = 'guarantee_not_covered' or branch = 'guarantee_replacement' then
    keep_b := o.buyer_fee_cents - o.buyer_fee_credit_cents;
    keep_s := o.seller_fee_cents - o.seller_fee_credit_cents;
  elsif branch in ('refusal_no_cause', 'no_show_buyer') then
    keep_b := 0;
    keep_s := round(o.deposit_cents * o.seller_fee_bps / 10000.0)::integer;
  elsif branch = 'guarantee_vet_costs' then
    -- The sale stood; the platform earned its fee on it.
    keep_b := o.buyer_fee_cents - o.buyer_fee_credit_cents;
    keep_s := o.seller_fee_cents - o.seller_fee_credit_cents;
  else
    keep_b := 0;
    keep_s := 0;
  end if;

  final_status := case when price + dep + trans > 0 then 'refunded' else 'released' end;

  update public.orders set
    status = final_status,
    settlement_branch = branch,
    refund_price_cents = price,
    refund_deposit_cents = dep,
    refund_transport_cents = trans,
    settled_buyer_fee_cents = keep_b,
    settled_seller_fee_cents = keep_s,
    remedy_cents = case when branch = 'guarantee_vet_costs' then price else null end,
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, final_status,
          coalesce(note, '') || ' [' || branch || ' price=' || price ||
          ' deposit=' || dep || ' transport=' || trans ||
          ' keptBuyerFee=' || keep_b || ' keptSellerFee=' || keep_s || ']');
end; $fn$;
revoke execute on function public.settle_order(uuid, text, text, integer) from anon, public;
grant execute on function public.settle_order(uuid, text, text, integer) to authenticated;
drop function if exists public.settle_order(uuid, text, text);
