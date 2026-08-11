-- Step 5b: points that cannot lose money.
--
-- The old shape: 150 points to each party on every confirmed handover, and
-- `fee_credit_10` priced a point at $0.0133 — so one completed sale minted about
-- $4 of liability against a fee that might be smaller than that. Points were
-- minted per EVENT while revenue is earned per VALUE, so a cheap sale lost money
-- by completing. `swag_pack` was worse: real physical cost of goods, and a
-- points-to-goods conversion is the shape regulators look at when deciding
-- whether something is stored value.
--
-- The new shape, and why it cannot run negative:
--
--   EARN     10 points per $1 of platform fee actually paid.
--   REDEEM   100 points = $1 off a platform fee. Nothing else.
--   CAP      a redemption may cover at most 50% of the fee on THAT order.
--
-- The cap is the load-bearing part. Whatever else mints points, a redemption can
-- only ever discount revenue the platform is collecting at that moment, and only
-- half of it. The platform keeps at least 50% of every fee no matter what, so
-- the reward programme cannot outrun the revenue that funds it.
--
-- Points also never convert to cash or goods now, which removes the stored-value
-- question rather than arguing about it.
--
-- Timing note: production holds ZERO points and ZERO redemptions, so this
-- changes no balance anyone earned. It is the cheapest moment this will ever be.

-- ============================================================== THE CATALOG
-- Real cost of goods and the only points-to-goods path. Disabled rather than
-- deleted so existing rows keep their foreign key and the history stays
-- readable.
update public.reward_catalog set enabled = false where key = 'swag_pack';

-- Superseded by redeem_fee_credit(), which is order-scoped and therefore
-- cappable. A standalone credit cannot know which fee it is discounting.
update public.reward_catalog set enabled = false where key = 'fee_credit_10';

-- These cost the platform NOTHING and are the rewards that actually pull people
-- back. They were the two that were switched off.
update public.reward_catalog set enabled = true where key in ('boost_post', 'feature_listing');

-- ============================================================== EARNING
/**
 * Points earned in proportion to fees actually paid. 10 points per $1 = one
 * point per 10 cents, hence cents/10.
 *
 * Awarded to BOTH sides, because both pay a fee. Uses the settled figure when
 * the order was settled — a buyer whose fee was refunded earns nothing on it,
 * which is the point: rewards track money the platform actually kept.
 */
create or replace function public.award_fee_points(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare o record; b_kept integer; s_kept integer;
begin
  select * into o from public.orders where id = target_order;
  if o is null then return; end if;

  b_kept := coalesce(o.settled_buyer_fee_cents, o.buyer_fee_cents);
  s_kept := coalesce(o.settled_seller_fee_cents, o.seller_fee_cents);

  if b_kept > 0 then
    perform public.award_points(o.buyer_id, b_kept / 10, 'fee_paid', 'order', o.id);
  end if;
  if s_kept > 0 then
    perform public.award_points(o.seller_id, s_kept / 10, 'fee_paid', 'order', o.id);
  end if;
end; $fn$;
revoke execute on function public.award_fee_points(uuid) from anon, authenticated, public;

/**
 * Fires wherever an order reaches `released` — buyer acceptance, the inspection
 * window elapsing, or a §4 not-covered settlement. A trigger rather than four
 * edits, so a future release path cannot forget to award.
 */
create or replace function public.points_on_order_released()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    perform public.award_fee_points(new.id);
  end if;
  return new;
end; $fn$;

drop trigger if exists trg_points_on_order_released on public.orders;
create trigger trg_points_on_order_released
after update of status on public.orders
for each row execute function public.points_on_order_released();

-- The handover award drops from 150 to 25 a side. Confirming a handover is worth
-- acknowledging, but it is an EVENT, and events must not be the main source of a
-- currency that discounts VALUE.
create or replace function public.points_on_handover()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null then
    perform public.award_points(new.buyer_id, 25, 'handover_confirmed', 'application', new.id);
    perform public.award_points(new.seller_id, 25, 'handover_confirmed', 'application', new.id);
  end if;
  return new;
end; $fn$;

-- ============================================================== REDEEMING
/**
 * Spend points against a specific order's platform fee. Order-scoped precisely
 * so the cap can exist — a standalone credit has no fee to be half of.
 *
 * 100 points = $1. A caller may not discount more than half of what they
 * themselves owe on that order, so the platform keeps at least 50% of every fee
 * regardless of how many points exist in the world.
 *
 * Returns the cents discounted, which the charge path subtracts.
 */
create or replace function public.redeem_fee_credit(target_order uuid, points integer)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  own_fee integer;
  max_cents integer;
  want_cents integer;
  spend_points integer;
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

  -- The cap. Half of your own fee on this order, never more.
  max_cents := own_fee / 2;
  want_cents := points / 100;
  if want_cents > max_cents then want_cents := max_cents; end if;
  if want_cents <= 0 then raise exception 'nothing_to_discount'; end if;

  spend_points := want_cents * 100;
  if public.points_balance(uid) < spend_points then raise exception 'insufficient_points'; end if;

  perform public.award_points(uid, -spend_points, 'fee_credit', 'order', target_order);

  if uid = o.buyer_id then
    update public.orders set buyer_fee_cents = buyer_fee_cents - want_cents, updated_at = now()
     where id = target_order;
  else
    update public.orders set seller_fee_cents = seller_fee_cents - want_cents, updated_at = now()
     where id = target_order;
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, o.status,
          'fee credit: ' || spend_points || ' points = ' || want_cents || 'c off');

  return want_cents;
end; $fn$;
revoke execute on function public.redeem_fee_credit(uuid, integer) from anon, public;
grant execute on function public.redeem_fee_credit(uuid, integer) to authenticated;
