-- The 50% cap was measured against the fee AS IT STOOD, and redeem_fee_credit
-- mutated that fee. So the cap reset on every call: $30 -> $15 -> $7.50 -> $3.75,
-- halving the remainder indefinitely and driving the platform's cut toward zero.
-- "At most half" only holds if "half" refers to a fixed quantity.
--
-- Found by probing a SECOND redemption on an already-discounted order. The first
-- call looked perfect in isolation, which is exactly why one-shot checks miss
-- this class of bug.
--
-- The fee and the credit are now separate columns. The fee stays as struck, the
-- credit accumulates against it, and the cap compares total credit to the
-- ORIGINAL fee. Keeping both also makes the discount visible on the order
-- instead of silently shrinking a number the buyer already agreed to.

alter table public.orders
  add column if not exists buyer_fee_credit_cents integer not null default 0,
  add column if not exists seller_fee_credit_cents integer not null default 0;

alter table public.orders drop constraint if exists orders_fee_credit_within_half;
alter table public.orders add constraint orders_fee_credit_within_half
  check (buyer_fee_credit_cents * 2 <= buyer_fee_cents
     and seller_fee_credit_cents * 2 <= seller_fee_cents);

grant select (buyer_fee_credit_cents, seller_fee_credit_cents) on public.orders to authenticated;

-- The buyer owes the fee LESS whatever credit they applied.
create or replace function public.order_due_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select o.amount_cents + o.transport_cents + o.buyer_fee_cents - o.buyer_fee_credit_cents
    from public.orders o where o.id = target_order;
$fn$;
revoke execute on function public.order_due_cents(uuid) from anon, public;
grant execute on function public.order_due_cents(uuid) to authenticated;

create or replace function public.redeem_fee_credit(target_order uuid, points integer)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  own_fee integer;
  used integer;
  headroom integer;
  want_cents integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if points is null or points < 100 then raise exception 'minimum_100_points'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;
  if o.status not in ('draft', 'awaiting_payment') then raise exception 'order_already_underway'; end if;

  if uid = o.buyer_id then
    own_fee := o.buyer_fee_cents; used := o.buyer_fee_credit_cents;
  else
    own_fee := o.seller_fee_cents; used := o.seller_fee_credit_cents;
  end if;
  if own_fee <= 0 then raise exception 'no_fee_to_discount'; end if;

  -- Half of the ORIGINAL fee, less whatever has already been credited.
  headroom := (own_fee / 2) - used;
  if headroom <= 0 then raise exception 'fee_credit_cap_reached'; end if;

  -- 100 points = $1 = 100 cents, so one point is one cent.
  want_cents := least(points, headroom);
  if public.points_balance(uid) < want_cents then raise exception 'insufficient_points'; end if;

  perform public.award_points(uid, -want_cents, 'fee_credit', 'order', target_order);

  if uid = o.buyer_id then
    update public.orders set buyer_fee_credit_cents = buyer_fee_credit_cents + want_cents,
                             updated_at = now() where id = target_order;
  else
    update public.orders set seller_fee_credit_cents = seller_fee_credit_cents + want_cents,
                             updated_at = now() where id = target_order;
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, o.status,
          'fee credit: ' || want_cents || ' points = ' || want_cents || 'c off');

  return want_cents;
end; $fn$;
revoke execute on function public.redeem_fee_credit(uuid, integer) from anon, public;
grant execute on function public.redeem_fee_credit(uuid, integer) to authenticated;

-- Points are earned on the fee the platform actually KEPT, which is now the fee
-- less any credit the member applied. Earning points on a discount they
-- themselves paid for would be a small perpetual-motion machine.
create or replace function public.award_fee_points(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare o record; b_kept integer; s_kept integer;
begin
  select * into o from public.orders where id = target_order;
  if o is null then return; end if;

  b_kept := coalesce(o.settled_buyer_fee_cents, o.buyer_fee_cents - o.buyer_fee_credit_cents);
  s_kept := coalesce(o.settled_seller_fee_cents, o.seller_fee_cents - o.seller_fee_credit_cents);

  if b_kept > 0 then
    perform public.award_points(o.buyer_id, b_kept / 10, 'fee_paid', 'order', o.id);
  end if;
  if s_kept > 0 then
    perform public.award_points(o.seller_id, s_kept / 10, 'fee_paid', 'order', o.id);
  end if;
end; $fn$;
revoke execute on function public.award_fee_points(uuid) from anon, authenticated, public;
