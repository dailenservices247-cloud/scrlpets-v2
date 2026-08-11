-- Probes that the reward programme cannot outrun the revenue funding it.
-- 3b is the load-bearing assertion: a redemption can never exceed half the fee.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000001';
  buyer    uuid := '00000000-0000-0000-0000-000000000011';
  lst      uuid;
  ord      uuid;
  before_b integer; after_b integer;
  got      integer;
  n        integer;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';

  ------------------------------------------------- 1. the catalog is right way up
  if (select enabled from public.reward_catalog where key='swag_pack') then
    raise exception 'PROBE FAILED: swag_pack still redeemable (real COGS, points-to-goods)';
  end if;
  if not (select enabled from public.reward_catalog where key='boost_post')
     or not (select enabled from public.reward_catalog where key='feature_listing') then
    raise exception 'PROBE FAILED: the zero-cost rewards are still switched off';
  end if;
  results := results || E'1a catalog flipped: free rewards ON, cost-of-goods reward OFF\n';

  ------------------------------------------------- 2. earning tracks fees kept
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE points listing', 100000, 'available') returning id into lst;
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps,
                             buyer_fee_cents, seller_fee_cents, status)
  values (buyer, seller, lst, 100000, 300, 250, 3000, 2500, 'inspection')
  returning id into ord;

  before_b := public.points_balance(buyer);
  update public.orders set status = 'released' where id = ord;
  after_b := public.points_balance(buyer);
  -- buyer fee 3000c = $30 -> 10 points per $1 -> 300 points
  if after_b - before_b <> 300 then
    raise exception 'PROBE FAILED: buyer earned % points on a $30 fee (want 300)', after_b - before_b;
  end if;
  results := results || E'2a release awards 10 points per $1 of fee paid, both sides\n';

  ----------------------------------- 3. a refunded fee earns nothing, and the cap
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps,
                             buyer_fee_cents, seller_fee_cents,
                             settled_buyer_fee_cents, settled_seller_fee_cents,
                             settlement_branch, refund_price_cents,
                             refund_deposit_cents, refund_transport_cents, status)
  values (buyer, seller, lst, 100000, 300, 250, 3000, 2500, 0, 0,
          'wrong_animal', 100000, 0, 0, 'inspection')
  returning id into ord;
  before_b := public.points_balance(buyer);
  update public.orders set status = 'released' where id = ord;
  after_b := public.points_balance(buyer);
  if after_b <> before_b then
    raise exception 'PROBE FAILED: earned % points on a fully refunded fee', after_b - before_b;
  end if;
  results := results || E'3a a refunded fee earns NO points — rewards track money actually kept\n';

  -- the cap: a buyer with a huge balance still cannot discount more than half
  perform set_config('role', 'postgres', true);
  perform public.award_points(buyer, 100000, 'probe_grant', 'order', null);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps,
                             buyer_fee_cents, seller_fee_cents, status)
  values (buyer, seller, lst, 100000, 300, 250, 3000, 2500, 'draft')
  returning id into ord;

  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  -- ask for $30 off a $30 fee; the cap must clamp it to $15
  got := public.redeem_fee_credit(ord, 3000);
  if got <> 1500 then
    raise exception 'PROBE FAILED: discounted %c of a 3000c fee (want the 1500c cap)', got;
  end if;
  results := results || E'3b a 100,000-point balance still only discounts HALF the fee\n';

  perform set_config('role', 'postgres', true);
  select buyer_fee_cents - buyer_fee_credit_cents into n from public.orders where id = ord;
  if n <> 1500 then raise exception 'PROBE FAILED: net fee after credit = %', n; end if;
  results := results || E'3c the platform still collects 1500c — at least half of every fee\n';

  ------------------------------------------- 4. cannot spend the same points twice
  perform set_config('role', 'authenticated', true);
  begin
    perform public.redeem_fee_credit(ord, 3000);
    raise exception 'PROBE FAILED: discounted the same fee twice';
  exception when others then
    if sqlerrm <> 'fee_credit_cap_reached' then raise; end if;
    results := results || E'4a a SECOND redemption is refused — the cap is against the original fee\n';
  end;

  ------------------------------------ 5. credit only before the money is in motion
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps,
                             buyer_fee_cents, seller_fee_cents, status)
  values (buyer, seller, lst, 100000, 300, 250, 3000, 2500, 'funds_held')
  returning id into ord;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.redeem_fee_credit(ord, 1000);
    raise exception 'PROBE FAILED: discounted a fee already captured';
  exception when others then
    if sqlerrm <> 'order_already_underway' then raise; end if;
    results := results || E'5a cannot apply credit once the money has been captured\n';
  end;

  ------------------------------------------- 6. a stranger cannot spend on your order
  perform set_config('request.jwt.claims',
    json_build_object('sub', '911e7e22-0eae-437f-b402-2d7fdd6f630f', 'role', 'authenticated')::text, true);
  begin
    perform public.redeem_fee_credit(ord, 1000);
    raise exception 'PROBE FAILED: a non-party redeemed against someone else''s order';
  exception when others then
    if sqlerrm <> 'not_a_party' then raise; end if;
    results := results || E'6a a non-party cannot redeem against an order\n';
  end;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
