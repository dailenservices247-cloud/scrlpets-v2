-- Step 4: the fee model. A cut from the buyer AND a cut from the seller, the
-- seller's modulated by their subscription, both FROZEN onto the order.
--
-- What was here could not express it. `fee_cents` + `fee_payer` is ONE amount
-- and a label saying who bears it — buyer or seller, never both. And the rate
-- came from `public.fee_bps()`, which read a global flag: a single number for
-- every seller, unaffected by anything they had paid for.
--
-- THE RATES ARE FROZEN AT CREATION, not looked up when the money moves. Legacy
-- read the seller's tier at charge time from a mutable profile field, so a
-- seller who changed plan mid-transaction changed what a completed sale had
-- earned. Freezing makes an order a record of the deal that was actually struck.
--
-- THE BUYER FEE IS CAPPED. 3% of a $10,000 animal is $300 of pure friction on
-- exactly the sales worth the most to everyone. Legacy capped at $250 and was
-- right to; this caps at $150.
--
-- Buyers do not subscribe — sellers do. So the buyer fee is flat and the
-- subscription moves the seller fee. That is what makes the subscription
-- rational rather than arbitrary.

-- ============================================================== THE SCHEDULE
/**
 * One place the buyer-side numbers live. Deliberately functions rather than a
 * config table: there are two of them, they change roughly never, and a table
 * would need its own RLS and its own "who may edit the fee schedule" question.
 *
 * ponytail: promote to a table the first time these need to differ by region or
 * by campaign.
 */
create or replace function public.buyer_fee_bps()
returns integer language sql immutable as $fn$ select 300; $fn$;

create or replace function public.buyer_fee_cap_cents()
returns integer language sql immutable as $fn$ select 15000; $fn$;

/**
 * The seller's rate, from their subscription at THIS MOMENT. Callers freeze the
 * result onto the order; nothing downstream calls this again.
 *
 * No subscription, an expired one, or a status that is not active all fall to
 * the free rate. That default matters: a lapsed Pro seller pays the free rate,
 * they do not get a free ride on a plan they stopped paying for.
 *
 * ponytail: step 5 adds pausing, and a paused subscription resolves here to the
 * FREE rate — that single fact is what makes pausing self-policing, because a
 * seller who sells while paused pays more, not less.
 */
create or replace function public.seller_fee_bps_for(target_profile uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select t.fee_bps
       from public.subscriptions s
       join public.subscription_tiers t on t.key = s.tier_key
      where s.profile_id = target_profile
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
        and t.enabled
      order by t.fee_bps asc
      limit 1),
    (select t.fee_bps from public.subscription_tiers t where t.key = 'free'),
    500
  );
$fn$;
revoke execute on function public.seller_fee_bps_for(uuid) from anon, public;
grant execute on function public.seller_fee_bps_for(uuid) to authenticated;

-- ================================================================ THE ORDER
alter table public.orders
  add column if not exists buyer_fee_bps integer not null default 0,
  add column if not exists seller_fee_bps integer not null default 0,
  add column if not exists buyer_fee_cents integer not null default 0,
  add column if not exists seller_fee_cents integer not null default 0,
  -- What the platform KEEPS after settlement. Not "refunded" — for the seller
  -- side a refund is meaningless (a fully refunded seller received nothing to
  -- take a cut of). Recording what is retained states the outcome directly and
  -- is the number that reconciles against the Stripe balance.
  add column if not exists settled_buyer_fee_cents integer,
  add column if not exists settled_seller_fee_cents integer;

alter table public.orders drop constraint if exists orders_fees_nonneg;
alter table public.orders add constraint orders_fees_nonneg
  check (buyer_fee_cents >= 0 and seller_fee_cents >= 0
         and buyer_fee_bps >= 0 and seller_fee_bps >= 0);

-- A settled order carries BOTH retained figures or neither, for the same reason
-- the price/deposit/transport split does: a half-written settlement cannot be
-- audited, and this table is the chargeback evidence.
alter table public.orders drop constraint if exists orders_settled_fees_complete;
alter table public.orders add constraint orders_settled_fees_complete
  check (num_nulls(settled_buyer_fee_cents, settled_seller_fee_cents) in (0, 2));

grant select (buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
              settled_buyer_fee_cents, settled_seller_fee_cents)
  on public.orders to authenticated;

/**
 * The buyer's total. Now includes the buyer fee, because that is money the buyer
 * actually pays — leaving it out would mark an order fully captured while the
 * platform's own cut was still outstanding.
 *
 * The deposit remains excluded: it is a PORTION of the price, not an addition.
 */
create or replace function public.order_due_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select o.amount_cents + o.transport_cents + o.buyer_fee_cents
    from public.orders o where o.id = target_order;
$fn$;
revoke execute on function public.order_due_cents(uuid) from anon, public;
grant execute on function public.order_due_cents(uuid) to authenticated;

-- ============================================================ ORDER CREATION
create or replace function public.create_order(target_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  oid uuid;
  b_bps integer;
  s_bps integer;
  b_fee integer;
  s_fee integer;
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
  end if;

  -- A seller who cannot receive money must not be able to take any. The listing
  -- gate already refuses new animal listings without a payout account, but a
  -- listing published BEFORE the seller's account fell out of good standing
  -- would otherwise still be buyable.
  if not public.can_receive_payouts(l.seller_id) then raise exception 'seller_cannot_receive_payouts'; end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(l.seller_id);
  b_fee := least(round(l.price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(l.price_cents * s_bps / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, listing_id, title_snapshot, amount_cents, currency,
    buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents
  )
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency,
          b_bps, s_bps, b_fee, s_fee)
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft',
          'order created; buyer ' || b_bps || 'bps=' || b_fee ||
          ', seller ' || s_bps || 'bps=' || s_fee);
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid) from anon, public;
grant execute on function public.create_order(uuid) to authenticated;

-- ============================================================== SETTLEMENT
/**
 * The published policy, now including the platform's own cut.
 *
 * The rule underneath every branch: THE PLATFORM KEEPS FEES ONLY IN PROPORTION
 * TO MONEY THAT ACTUALLY CHANGED HANDS.
 *
 *   §3 wrong animal, §2 seller no-show, §4 upheld/ambiguous, seller's own refund
 *       -> nothing changed hands and, where there is fault, it is the seller's.
 *          Both fees zero. Keeping a cut of a sale that never happened is
 *          indefensible and would be the platform profiting from its own
 *          failure cases.
 *
 *   §1 refusal without cause, §2 buyer no-show
 *       -> the buyer received nothing, so their fee returns in full. The seller
 *          DOES keep the deposit, so the platform keeps its cut of THAT and
 *          nothing more.
 *
 *   §4 not covered
 *       -> the sale stands. Fees stand.
 *
 * Note what this cannot fix: Stripe does not return its processing fee on a
 * refund, so every refunded order costs the platform roughly 2.9% + 30c of the
 * original charge regardless of fault. That is a real cost of the buyer
 * protection, not an accounting error.
 */
create or replace function public.settle_order(
  target_order uuid, branch text, note text default null
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

  if branch = 'guarantee_not_covered' then
    keep_b := o.buyer_fee_cents;
    keep_s := o.seller_fee_cents;
  elsif branch in ('refusal_no_cause', 'no_show_buyer') then
    keep_b := 0;
    keep_s := round(o.deposit_cents * o.seller_fee_bps / 10000.0)::integer;
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
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, final_status,
          coalesce(note, '') || ' [' || branch || ' price=' || price ||
          ' deposit=' || dep || ' transport=' || trans ||
          ' keptBuyerFee=' || keep_b || ' keptSellerFee=' || keep_s || ']');
end; $fn$;
revoke execute on function public.settle_order(uuid, text, text) from anon, public;
grant execute on function public.settle_order(uuid, text, text) to authenticated;

/**
 * What the buyer is actually owed back: the ruled refund of price, deposit and
 * transport, PLUS the portion of their own fee the platform did not keep.
 * Derived so it cannot drift from the parts it is made of.
 */
create or replace function public.order_buyer_refund_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce(o.refund_price_cents, 0) + coalesce(o.refund_deposit_cents, 0)
       + coalesce(o.refund_transport_cents, 0)
       + (o.buyer_fee_cents - coalesce(o.settled_buyer_fee_cents, o.buyer_fee_cents))
    from public.orders o where o.id = target_order;
$fn$;
revoke execute on function public.order_buyer_refund_cents(uuid) from anon, public;
grant execute on function public.order_buyer_refund_cents(uuid) to authenticated;

-- ==================================================== THE OLD MODEL RETIRES
-- Two disagreeing fee sources is how legacy ended up charging different rates
-- on different code paths. `subscription_tiers` wins; the global flag goes.
alter table public.orders drop column if exists fee_cents;
alter table public.orders drop column if exists fee_payer;
drop function if exists public.fee_bps();
delete from public.platform_flags where key = 'fee_bps';
