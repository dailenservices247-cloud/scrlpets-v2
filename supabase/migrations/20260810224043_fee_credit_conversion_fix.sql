-- redeem_fee_credit converted points to cents by dividing by 100, which is wrong
-- at the ruled rate. 100 points = $1 = 100 cents, so a point IS a cent: the
-- conversion is 1:1 and the division made every credit 100x too small. A caller
-- asking to spend 3000 points on a $30 fee got 30 CENTS off instead of the $15
-- the cap allows.
--
-- Caught by exact-arithmetic probing, not by reading. The function ran, returned
-- a number, updated a fee and looked entirely healthy — it was just quietly
-- worthless, which is the failure mode a "did it error?" check never finds.
--
-- The economics this restores: earning is cents/10 (10 points per $1 of fee) and
-- redemption is 1 point per cent, so a member earns back 10% of fees paid as
-- future fee credit — and the 50% cap still means the platform keeps at least
-- half of every fee regardless.

create or replace function public.redeem_fee_credit(target_order uuid, points integer)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  own_fee integer;
  max_cents integer;
  want_cents integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if points is null or points < 100 then raise exception 'minimum_100_points'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;
  if o.status not in ('draft', 'awaiting_payment') then raise exception 'order_already_underway'; end if;

  own_fee := case when uid = o.buyer_id then o.buyer_fee_cents else o.seller_fee_cents end;
  if own_fee <= 0 then raise exception 'no_fee_to_discount'; end if;

  -- 100 points = $1 = 100 cents, so one point is one cent.
  max_cents := own_fee / 2;
  want_cents := least(points, max_cents);
  if want_cents <= 0 then raise exception 'nothing_to_discount'; end if;
  if public.points_balance(uid) < want_cents then raise exception 'insufficient_points'; end if;

  perform public.award_points(uid, -want_cents, 'fee_credit', 'order', target_order);

  if uid = o.buyer_id then
    update public.orders set buyer_fee_cents = buyer_fee_cents - want_cents, updated_at = now()
     where id = target_order;
  else
    update public.orders set seller_fee_cents = seller_fee_cents - want_cents, updated_at = now()
     where id = target_order;
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, o.status,
          'fee credit: ' || want_cents || ' points = ' || want_cents || 'c off');

  return want_cents;
end; $fn$;
revoke execute on function public.redeem_fee_credit(uuid, integer) from anon, public;
grant execute on function public.redeem_fee_credit(uuid, integer) to authenticated;
