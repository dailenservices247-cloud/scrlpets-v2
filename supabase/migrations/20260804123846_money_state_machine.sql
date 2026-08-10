-- The money state machine. Built, verified, and OFF — every path below still
-- raises 'payments_disabled' until the platform flag flips.
--
-- What the existing rails got wrong, and why this is not a cosmetic extension:
--
-- 1. THE BUYER COULD DECLARE THEIR OWN MONEY HELD. advance_order allowed
--    awaiting_payment -> funds_held when uid = buyer_id. Nothing consulted
--    Stripe. An order could reach the state the whole UI reads as "funds
--    secured" with no money captured anywhere. That transition is removed from
--    the client surface entirely and now lives in a function the client role
--    cannot execute.
--
-- 2. ONE amount_cents CANNOT EXPRESS A SINGLE REFUND BRANCH. The dispute policy
--    settles three independent sums: the animal price, the deposit, and the
--    transport fee. §1 refunds the price, forfeits the deposit to the seller and
--    does NOT refund transport; §3 refunds all three. With one column, both are
--    the same number and the policy cannot be applied mechanically — it becomes
--    a judgement call every time, which is exactly what a published rule is for.
--
-- 3. RELEASE WAS ONE BUYER CLICK. The policy releases on code entry PLUS anchor
--    verification, then an inspection window. Those are the two facts that make
--    a chargeback defensible, so they are preconditions here, not UI steps.
--
-- The states, and what each one means physically:
--
--   draft             an order exists, nothing committed
--   awaiting_payment  buyer sent to Stripe
--   funds_held        Stripe captured. THE ANIMAL HAS NOT MOVED.
--   dispatched        seller released the animal, capture already proven
--   inspection        handover verified by code + anchor; window running
--   released          transferred to the seller, final
--   refunded          settled back to the buyer per a named branch
--   cancelled         abandoned before any money moved
--   disputed          adjudication pending (§4 vet finding, or a contested §1/§2)
--
-- Capture strictly precedes dispatch because that ordering is the entire reason
-- a buyer is willing to hand money to a stranger for an animal they have not met.

-- ============================================================ MONEY DECOMPOSED
alter table public.orders
  add column if not exists deposit_cents integer not null default 0,
  add column if not exists transport_cents integer not null default 0,
  add column if not exists handover_code text,
  add column if not exists dispatched_at timestamptz,
  add column if not exists handover_at timestamptz,
  add column if not exists inspection_hours integer not null default 24,
  add column if not exists inspection_ends_at timestamptz,
  add column if not exists settlement_branch text,
  add column if not exists refund_price_cents integer,
  add column if not exists refund_deposit_cents integer,
  add column if not exists refund_transport_cents integer;

comment on column public.orders.amount_cents is
  'The animal price only. Deposit and transport are separate columns because the dispute policy settles them independently.';

alter table public.orders drop constraint if exists orders_money_nonneg;
alter table public.orders add constraint orders_money_nonneg
  check (deposit_cents >= 0 and transport_cents >= 0);

-- A deposit larger than the animal costs is not a deposit.
alter table public.orders drop constraint if exists orders_deposit_within_price;
alter table public.orders add constraint orders_deposit_within_price
  check (deposit_cents <= amount_cents);

-- Platform minimum 24 hours; a seller may extend and may not waive.
alter table public.orders drop constraint if exists orders_inspection_min;
alter table public.orders add constraint orders_inspection_min
  check (inspection_hours >= 24);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status = any (array[
    'draft','awaiting_payment','funds_held','dispatched',
    'inspection','released','refunded','cancelled','disputed'
  ])
);

alter table public.orders drop constraint if exists orders_settlement_branch_check;
alter table public.orders add constraint orders_settlement_branch_check check (
  settlement_branch is null or settlement_branch = any (array[
    'refusal_no_cause',      -- §1
    'no_show_buyer',         -- §2, buyer failed to appear
    'no_show_seller',        -- §2, animal not produced
    'wrong_animal',          -- §3
    'guarantee_upheld',      -- §4, vet finding for the buyer
    'guarantee_not_covered', -- §4, released to the seller
    'guarantee_ambiguous',   -- §4, contra proferentem — buyer's favour
    'seller_refund'          -- seller chose to refund, no dispute
  ])
);

-- A settled order carries the full split or none of it. A half-written
-- settlement is unauditable, and this table is the chargeback evidence.
alter table public.orders drop constraint if exists orders_settlement_complete;
alter table public.orders add constraint orders_settlement_complete check (
  num_nulls(settlement_branch, refund_price_cents, refund_deposit_cents, refund_transport_cents)
    in (0, 4)
);

-- The handover code is the buyer's proof of presence. Readable ONLY by the
-- buyer — a seller who could read it could release their own funds without the
-- buyer ever appearing, which is the single thing the code exists to prevent.
-- Same shape as the identity anchor: revoke the table grant, then grant an
-- explicit column allowlist. A column-level REVOKE against a table-level grant
-- is a silent no-op, so the order below is load-bearing.
revoke select on public.orders from anon, authenticated;
grant select (
  id, buyer_id, seller_id, listing_id, title_snapshot,
  amount_cents, deposit_cents, transport_cents, currency,
  fee_cents, fee_payer, status,
  dispatched_at, handover_at, inspection_hours, inspection_ends_at,
  settlement_branch, refund_price_cents, refund_deposit_cents, refund_transport_cents,
  created_at, updated_at
) on public.orders to authenticated;

/**
 * The buyer's own code. Nobody else can read it, including the seller who will
 * later be asked to type it in.
 */
create or replace function public.my_handover_code(target_order uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select o.handover_code from public.orders o
   where o.id = target_order and o.buyer_id = (select auth.uid());
$fn$;
revoke execute on function public.my_handover_code(uuid) from anon, public;
grant execute on function public.my_handover_code(uuid) to authenticated;

-- ==================================================== CAPTURE IS NOT A CLAIM
/**
 * The ONLY route into funds_held, and deliberately not executable by a client
 * role: it is called by the Stripe webhook handler with the service key, after
 * Stripe confirms the capture. A buyer cannot assert their own payment.
 *
 * The handover code is minted here, at the moment money actually exists —
 * before that there is nothing for a code to protect.
 */
create or replace function public.mark_funds_held(
  target_order uuid, payment_intent_id text
)
returns void language plpgsql security definer set search_path = public as $fn$
declare o record;
begin
  if payment_intent_id is null or btrim(payment_intent_id) = '' then
    raise exception 'payment_intent_required';
  end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'invalid_transition'; end if;

  update public.orders set
    status = 'funds_held',
    stripe_payment_intent_id = payment_intent_id,
    -- Ambiguous characters removed: this gets read aloud in a driveway.
    handover_code = (
      select string_agg(substr('ACDEFHJKLMNPRTUVWXY34679', 1 + floor(random() * 24)::int, 1), '')
        from generate_series(1, 6)
    ),
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, null, o.status, 'funds_held', 'stripe capture confirmed');
end; $fn$;
revoke execute on function public.mark_funds_held(uuid, text) from anon, authenticated, public;

/**
 * The seller releases the animal. Reachable only from funds_held, which is the
 * capture-before-dispatch invariant expressed as a transition rather than a
 * warning in a document.
 */
create or replace function public.mark_dispatched(target_order uuid, note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'funds_held' then raise exception 'funds_not_held'; end if;

  update public.orders set status = 'dispatched', dispatched_at = now(), updated_at = now()
   where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', note);
end; $fn$;
revoke execute on function public.mark_dispatched(uuid, text) from anon, public;
grant execute on function public.mark_dispatched(uuid, text) to authenticated;

-- ======================================================== CODE PLUS ANCHOR
/**
 * The handover. Called by the SELLER, and it needs two things they cannot
 * produce alone:
 *
 *   the code    — held by the buyer, so entry proves the buyer was there
 *   the anchor  — scanned off the animal, so it proves WHICH animal was there
 *
 * Either one alone is forgeable by a determined seller. Together they are the
 * evidence pair that wins a chargeback representment, which is why both are
 * preconditions rather than fields collected afterwards.
 *
 * A code mismatch and an anchor mismatch raise DIFFERENT errors on purpose:
 * a wrong anchor is §3 (wrong animal, seller's fault, automatic account review)
 * and the caller has to be able to tell that apart from a mistyped code.
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
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'dispatched' then raise exception 'not_dispatched'; end if;

  -- normalise_anchor is "fold case, drop non-alphanumerics" — the same
  -- comparison a code needs, since both get read aloud and retyped.
  if public.normalise_anchor(entered_code) is distinct from public.normalise_anchor(o.handover_code)
  then raise exception 'code_mismatch'; end if;

  select l.creature_id into creature from public.listings l where l.id = o.listing_id;

  -- An animal with no registered anchor cannot be anchor-verified, and the
  -- listing said so via its assurance level. The code alone carries the
  -- handover; nothing here pretends otherwise.
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

/**
 * Buyer accepts early and the seller gets paid sooner. The window is a floor
 * under the buyer, not a delay imposed on them.
 */
create or replace function public.accept_delivery(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id then raise exception 'not_the_buyer'; end if;
  if o.status <> 'inspection' then raise exception 'not_in_inspection'; end if;

  update public.orders set status = 'released', updated_at = now() where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'released', 'buyer accepted delivery');
end; $fn$;
revoke execute on function public.accept_delivery(uuid) from anon, public;
grant execute on function public.accept_delivery(uuid) to authenticated;

/**
 * The window closing is the default outcome — silence releases to the seller.
 * Service-role only; a scheduled job calls it. Deliberately skips 'disputed'
 * orders: raising a §4 complaint inside the window must stop the clock, or the
 * complaint is worthless the moment it is filed late in the window.
 */
create or replace function public.release_expired_inspections()
returns integer language plpgsql security definer set search_path = public as $fn$
declare n integer := 0; r record;
begin
  for r in
    select id, status from public.orders
     where status = 'inspection' and inspection_ends_at is not null and inspection_ends_at <= now()
     for update skip locked
  loop
    update public.orders set status = 'released', updated_at = now() where id = r.id;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (r.id, null, r.status, 'released', 'inspection window elapsed');
    n := n + 1;
  end loop;
  return n;
end; $fn$;
revoke execute on function public.release_expired_inspections() from anon, authenticated, public;

/**
 * Raising a dispute stops the release clock. Either party may — a seller whose
 * buyer vanished needs this as much as a buyer holding a vet report.
 */
create or replace function public.dispute_order(target_order uuid, reason text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if reason is null or btrim(reason) = '' then raise exception 'reason_required'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;
  if o.status not in ('funds_held', 'dispatched', 'inspection') then
    raise exception 'nothing_held';
  end if;

  update public.orders set status = 'disputed', updated_at = now() where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'disputed', reason);
end; $fn$;
revoke execute on function public.dispute_order(uuid, text) from anon, public;
grant execute on function public.dispute_order(uuid, text) to authenticated;

-- ============================================================ THE BRANCHES
/**
 * The published policy as executable code. The split is DERIVED from the branch
 * rather than typed by the adjudicator, so the same failure mode cannot settle
 * two different ways on two different days — which is the whole claim a
 * published rule makes.
 *
 * Adjudication is a platform-admin action (Dailen, sole adjudicator at launch).
 * seller_refund is the one branch a seller may invoke on their own order —
 * choosing to refund a buyer needs no adjudicator.
 */
create or replace function public.settle_order(
  target_order uuid, branch text, note text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  price integer; dep integer; trans integer;
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

  -- §1 refusal without stated cause: price back, deposit to the seller who held
  -- the animal off-market, transport NOT refunded — the driver drove.
  -- §2 follows fault on both deposit and transport.
  -- §3 wrong animal: everything back, including transport.
  -- §4 splits on the vet finding, with ambiguity going the buyer's way.
  case branch
    when 'refusal_no_cause'      then price := o.amount_cents; dep := 0;               trans := 0;
    when 'no_show_buyer'         then price := o.amount_cents; dep := 0;               trans := 0;
    when 'no_show_seller'        then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'wrong_animal'          then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'guarantee_upheld'      then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'guarantee_ambiguous'   then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    when 'guarantee_not_covered' then price := 0;              dep := 0;               trans := 0;
    when 'seller_refund'         then price := o.amount_cents; dep := o.deposit_cents; trans := o.transport_cents;
    else raise exception 'unknown_branch';
  end case;

  final_status := case when price + dep + trans > 0 then 'refunded' else 'released' end;

  update public.orders set
    status = final_status,
    settlement_branch = branch,
    refund_price_cents = price,
    refund_deposit_cents = dep,
    refund_transport_cents = trans,
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, final_status,
          coalesce(note, '') || ' [' || branch || ' price=' || price ||
          ' deposit=' || dep || ' transport=' || trans || ']');
end; $fn$;
revoke execute on function public.settle_order(uuid, text, text) from anon, public;
grant execute on function public.settle_order(uuid, text, text) to authenticated;

-- ================================================== CLOSE THE OLD BACK DOOR
/**
 * advance_order kept the two transitions that are genuinely a party's to make
 * and lost the ones that are now proven rather than asserted. funds_held,
 * release and refund are unreachable from here — see mark_funds_held,
 * confirm_handover_and_hold, accept_delivery and settle_order.
 */
create or replace function public.advance_order(
  target_order uuid, new_status text, note text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record; allowed boolean := false;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;

  allowed := case
    when o.status = 'draft' and new_status = 'awaiting_payment' and uid = o.buyer_id then true
    when o.status in ('draft','awaiting_payment') and new_status = 'cancelled' then true
    else false
  end;
  if not allowed then raise exception 'invalid_transition'; end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, new_status, note);
  update public.orders set status = new_status, updated_at = now() where id = target_order;
end; $fn$;

create index if not exists idx_orders_inspection_due
  on public.orders (inspection_ends_at) where status = 'inspection';
