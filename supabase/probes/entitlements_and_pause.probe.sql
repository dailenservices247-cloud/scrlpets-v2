-- Probes the paywall and the pause, rolled back.
-- 3b is the load-bearing one: a paused subscription must pay the FREE rate, or
-- a seller pays for Pro only during the months they are not using it.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000001';
  buyer    uuid := '00000000-0000-0000-0000-000000000011';
  lst      uuid;
  ord      uuid;
  sid      uuid;
  n        integer;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  delete from public.subscriptions where profile_id = seller;

  ---------------------------------------------------- 1. free gets nothing gated
  if public.has_entitlement(seller, 'brand_page') then
    raise exception 'PROBE FAILED: unsubscribed seller has a gated entitlement';
  end if;
  if public.seller_fee_bps_for(seller) <> 500 then
    raise exception 'PROBE FAILED: unsubscribed seller is not on the free rate';
  end if;
  results := results || E'1a free seller: no gated entitlements, 5% fee\n';

  ------------------------------------------------------------ 2. Pro unlocks
  insert into public.subscriptions (profile_id, tier_key, status, created_at)
  values (seller, 'pro_12mo', 'active', now() - interval '60 days')
  returning id into sid;

  select count(*) into n from (values
    ('boost'),('brand_page'),('sell_merch'),('create_group'),
    ('publish_guide'),('featured_placement'),('analytics')) as e(k)
   where public.has_entitlement(seller, e.k);
  if n <> 7 then raise exception 'PROBE FAILED: has_entitlement resolves % of 7 rows', n; end if;
  -- MECHANISM, NOT A PROMISE. Nothing gates on these any more — the brand_page
  -- and sell_merch policies came off in 20260823165414, and TierList never
  -- rendered the list. has_entitlement is kept working for a future ADDITIVE
  -- paid surface, and this asserts the resolver still resolves. See the comment
  -- on tier_entitlements before building a gate from it.
  results := results || E'2a has_entitlement resolves every row for an active plan (mechanism only)\n';

  if public.seller_fee_bps_for(seller) <> 250 then
    raise exception 'PROBE FAILED: Pro is not on 2.5%%';
  end if;
  results := results || E'2b Pro pays 2.5%\n';

  ------------------------------------------------------- 3. the pause has teeth
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.pause_subscription(6);
  perform set_config('role', 'postgres', true);

  select count(*) into n from (values
    ('boost'),('brand_page'),('sell_merch'),('create_group'),
    ('publish_guide'),('featured_placement'),('analytics')) as e(k)
   where public.has_entitlement(seller, e.k);
  if n <> 0 then raise exception 'PROBE FAILED: paused seller keeps % entitlements', n; end if;
  results := results || E'3a paused: has_entitlement stops resolving, so a future gate would too\n';

  if public.seller_fee_bps_for(seller) <> 500 then
    raise exception 'PROBE FAILED: paused seller still pays the Pro rate — pausing is free money';
  end if;
  results := results || E'3b paused: pays the FREE rate (5%), so pausing is self-policing\n';

  -- nothing is destroyed: the subscription row survives with its history
  select pauses_used into n from public.subscriptions where id = sid;
  if n <> 1 then raise exception 'PROBE FAILED: pause not counted'; end if;
  results := results || E'3c paused: the subscription survives, pause counted\n';

  ---------------------------------------------------- 4. the allowance is real
  perform set_config('role', 'authenticated', true);
  begin
    perform public.pause_subscription(1);
    raise exception 'PROBE FAILED: paused twice at once';
  exception when others then
    if sqlerrm <> 'already_paused' then raise; end if;
    results := results || E'4a cannot pause while already paused\n';
  end;

  perform public.resume_subscription();
  perform set_config('role', 'postgres', true);
  if public.seller_fee_bps_for(seller) <> 250 then
    raise exception 'PROBE FAILED: resume did not restore the Pro rate';
  end if;
  results := results || E'4b resume restores the Pro rate and the entitlements\n';

  perform set_config('role', 'authenticated', true);
  perform public.pause_subscription(6);          -- second pause, 12 months total
  perform public.resume_subscription();
  begin
    perform public.pause_subscription(1);
    raise exception 'PROBE FAILED: a third pause on a two-pause plan';
  exception when others then
    if sqlerrm <> 'no_pauses_remaining' then raise; end if;
    results := results || E'4c a 12-month plan allows exactly two pauses\n';
  end;

  ------------------------------------------- 5. cannot pause mid-transaction
  perform set_config('role', 'postgres', true);
  update public.subscriptions set pauses_used = 0, paused_months_used = 0 where id = sid;
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE pause listing', 50000, 'available') returning id into lst;
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, status)
  values (buyer, seller, lst, 50000, 'funds_held') returning id into ord;

  perform set_config('role', 'authenticated', true);
  begin
    perform public.pause_subscription(1);
    raise exception 'PROBE FAILED: paused with a buyer mid-transaction';
  exception when others then
    if sqlerrm <> 'order_in_flight' then raise; end if;
    results := results || E'5a cannot pause with an order in flight\n';
  end;

  ------------------------------------------- 6. too soon, and plans without pauses
  perform set_config('role', 'postgres', true);
  update public.orders set status = 'released' where id = ord;
  update public.subscriptions set created_at = now() - interval '5 days' where id = sid;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.pause_subscription(1);
    raise exception 'PROBE FAILED: paused a five-day-old plan';
  exception when others then
    if sqlerrm <> 'too_soon_to_pause' then raise; end if;
    results := results || E'6a cannot buy a plan and immediately park it\n';
  end;

  perform set_config('role', 'postgres', true);
  update public.subscriptions set tier_key = 'pro', created_at = now() - interval '60 days'
   where id = sid;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.pause_subscription(1);
    raise exception 'PROBE FAILED: monthly Pro was pausable';
  exception when others then
    if sqlerrm <> 'plan_does_not_allow_pausing' then raise; end if;
    results := results || E'6b monthly Pro cannot pause — pauses are what long terms buy\n';
  end;

  ------------------------------------------- 7. nobody can grant themselves a perk
  begin
    insert into public.tier_entitlements (tier_key, entitlement_key) values ('free', 'brand_page');
    raise exception 'PROBE FAILED: client granted the free tier a paid feature';
  exception when insufficient_privilege then
    results := results || E'7a client cannot write tier_entitlements\n';
  end;

  perform set_config('role', 'postgres', true);
  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
