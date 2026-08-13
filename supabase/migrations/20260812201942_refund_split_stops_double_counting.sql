-- The refund split double-counted the deposit, in both directions.
--
-- `deposit_cents` is a PORTION of `amount_cents` — that is why order_due_cents
-- excludes it, and why a CHECK enforces deposit <= price. But settle_order set
-- refund_price_cents = amount_cents AND refund_deposit_cents = deposit_cents,
-- and anything summing them counted the deposit twice.
--
-- Two real consequences, latent until something finally added them up:
--
--   §3 WRONG ANIMAL   buyer paid 103,000 and was owed 123,000. The platform
--                     would have refunded 20,000 it never received.
--   §1 REFUSAL        price refunded in full, so the buyer got the deposit back
--                     — the exact thing §1 says they forfeit for holding an
--                     animal off-market. The rule read correctly and did the
--                     opposite.
--
-- Fixed by making the two columns non-overlapping instead of both meaning "the
-- deposit". They now partition the price:
--
--   refund_price_cents    the NON-deposit part of the price being returned
--   refund_deposit_cents  the deposit part being returned
--
-- so price + deposit is always <= amount_cents, each column means one thing, and
-- summing them is correct by construction.

create or replace function public.settle_order(
  target_order uuid, branch text, note text default null, remedy integer default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  base integer;              -- the price EXCLUDING the deposit portion
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

  if branch = 'guarantee_refund_on_return' and o.animal_returned_at is null then
    raise exception 'animal_not_returned';
  end if;

  base := o.amount_cents - o.deposit_cents;

  -- §1 refusal without cause and §2 buyer no-show: the price comes back MINUS
  -- the deposit, which forfeits to the seller who held the animal off-market.
  -- §2 seller no-show, §3 wrong animal, §4 upheld: everything, deposit included.
  case branch
    when 'refusal_no_cause'           then price := base; dep := 0;               trans := 0;
    when 'no_show_buyer'              then price := base; dep := 0;               trans := 0;
    when 'no_show_seller'             then price := base; dep := o.deposit_cents; trans := o.transport_cents;
    when 'wrong_animal'               then price := base; dep := o.deposit_cents; trans := o.transport_cents;
    when 'guarantee_refund_on_return' then price := base; dep := o.deposit_cents; trans := 0;
    when 'guarantee_ambiguous'        then price := base; dep := o.deposit_cents; trans := 0;
    when 'guarantee_vet_costs'        then price := least(coalesce(remedy, 0), o.amount_cents);
                                           dep := 0; trans := 0;
    when 'guarantee_replacement'      then price := 0; dep := 0; trans := 0;
    when 'guarantee_not_covered'      then price := 0; dep := 0; trans := 0;
    when 'seller_refund'              then price := base; dep := o.deposit_cents; trans := o.transport_cents;
    else raise exception 'unknown_branch';
  end case;

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

-- A refund can never exceed what the buyer actually paid. A constraint rather
-- than a comment, because this class of bug is invisible until something sums
-- the parts — which is exactly how it survived this long.
alter table public.orders drop constraint if exists orders_refund_within_price;
alter table public.orders add constraint orders_refund_within_price check (
  refund_price_cents is null
  or refund_deposit_cents is null
  or refund_price_cents + refund_deposit_cents <= amount_cents
);
