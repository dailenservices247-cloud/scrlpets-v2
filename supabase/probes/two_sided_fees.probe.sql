-- Probes the fee model with real arithmetic, rolled back.
-- Numbers are checked exactly: a fee model that is "roughly right" is wrong.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000001';
  buyer    uuid := '00000000-0000-0000-0000-000000000011';
  lst      uuid;
  ord      uuid;
  got      text;
  n        integer;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  perform public.upsert_payout_account(seller, 'acct_probe_fees', true, true, true);

  ------------------------------------------------------- 1. the schedule
  if public.buyer_fee_bps() <> 300 then raise exception 'PROBE FAILED: buyer bps'; end if;
  if public.buyer_fee_cap_cents() <> 15000 then raise exception 'PROBE FAILED: buyer cap'; end if;
  results := results || E'1a buyer fee 3%, capped at $150\n';

  -- no subscription -> free rate, not zero
  n := public.seller_fee_bps_for(seller);
  if n <> 600 then raise exception 'PROBE FAILED: unsubscribed seller bps = % (want the free tier rate)', n; end if;
  results := results || E'1b unsubscribed seller falls to the FREE rate, not to zero\n';

  ------------------------------------------------- 2. both fees frozen at creation
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE fee listing', 100000, 'available') returning id into lst;

  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(lst);

  perform set_config('role', 'postgres', true);
  select buyer_fee_cents || '/' || seller_fee_cents || '/' || buyer_fee_bps || '/' || seller_fee_bps
    into got from public.orders where id = ord;
  if got <> '3000/6000/300/600' then
    raise exception 'PROBE FAILED: fees on a $1000 sale were % (want 3000/6000/300/600)', got;
  end if;
  results := results || E'2a $1000 sale: buyer fee $30, seller fee $60, both rates frozen\n';

  -- due now includes the buyer fee, or an order looks paid while the cut is outstanding
  select public.order_due_cents(ord) into n;
  if n <> 103000 then raise exception 'PROBE FAILED: due = % (want 103000)', n; end if;
  results := results || E'2b order_due_cents includes the buyer fee: 103000\n';

  -- a later tier change must NOT rewrite a struck deal
  insert into public.subscriptions (profile_id, tier_key, status)
  values (seller, 'pro', 'active')
  on conflict do nothing;
  select buyer_fee_cents || '/' || seller_fee_cents into got from public.orders where id = ord;
  if got <> '3000/6000' then
    raise exception 'PROBE FAILED: existing order changed to % after the seller upgraded', got;
  end if;
  results := results || E'2c seller upgrading AFTER creation does not rewrite the existing order\n';

  -- but a NEW order gets the new rate
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(lst);
  perform set_config('role', 'postgres', true);
  select seller_fee_bps || '/' || seller_fee_cents into got from public.orders where id = ord;
  if got <> '300/3000' then
    raise exception 'PROBE FAILED: Pro order seller fee = % (want 300/3000)', got;
  end if;
  results := results || E'2d a NEW order picks up the Pro rate: 3%, $30 on $1000\n';

  ------------------------------------------------------------- 3. the cap
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE expensive', 1000000, 'available') returning id into lst;
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(lst);
  perform set_config('role', 'postgres', true);
  select buyer_fee_cents into n from public.orders where id = ord;
  if n <> 15000 then
    raise exception 'PROBE FAILED: buyer fee on a $10,000 animal = % (want the 15000 cap, not 30000)', n;
  end if;
  results := results || E'3a $10,000 animal: buyer fee capped at $150, not $300\n';

  ------------------------------------------- 4. settlement keeps only what was earned
  perform set_config('role', 'postgres', true);
  update public.orders set deposit_cents = 20000, status = 'inspection' where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '911e7e22-0eae-437f-b402-2d7fdd6f630f', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'wrong_animal', 'probe');
  perform set_config('role', 'postgres', true);
  select settled_buyer_fee_cents || '/' || settled_seller_fee_cents into got
    from public.orders where id = ord;
  if got <> '0/0' then
    raise exception 'PROBE FAILED: §3 kept fees % — the platform cannot profit from a wrong animal', got;
  end if;
  results := results || E'4a §3 wrong animal: platform keeps NOTHING from either side\n';

  -- §1: buyer fee returns in full; the seller keeps the deposit, so the platform
  -- keeps its cut of the deposit and nothing more
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, deposit_cents,
                             buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents, status)
  values (buyer, seller, lst, 100000, 20000, 300, 300, 3000, 3000, 'inspection')
  returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '911e7e22-0eae-437f-b402-2d7fdd6f630f', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'refusal_no_cause', 'probe');
  perform set_config('role', 'postgres', true);
  select settled_buyer_fee_cents || '/' || settled_seller_fee_cents into got
    from public.orders where id = ord;
  -- 3% of the 20000 deposit the seller keeps = 600
  if got <> '0/600' then
    raise exception 'PROBE FAILED: §1 kept % (want 0/600 — buyer fee back, seller fee on the kept deposit only)', got;
  end if;
  results := results || E'4b §1 refusal: buyer fee refunded, seller fee charged on the kept deposit only\n';

  select public.order_buyer_refund_cents(ord) into n;
  -- price 100000 + deposit 0 + transport 0 + buyer fee 3000 returned
  if n <> 103000 then raise exception 'PROBE FAILED: buyer owed % (want 103000)', n; end if;
  results := results || E'4c buyer refund total includes the returned buyer fee\n';

  -- §4 not covered: the sale stands, so the fees stand
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents, status)
  values (buyer, seller, lst, 100000, 300, 300, 3000, 3000, 'disputed')
  returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '911e7e22-0eae-437f-b402-2d7fdd6f630f', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'guarantee_not_covered', 'probe');
  perform set_config('role', 'postgres', true);
  select status || ' ' || settled_buyer_fee_cents || '/' || settled_seller_fee_cents into got
    from public.orders where id = ord;
  if got <> 'released 3000/3000' then
    raise exception 'PROBE FAILED: §4 not-covered settled as % (want released 3000/3000)', got;
  end if;
  results := results || E'4d §4 not covered: sale stands, both fees stand\n';

  ------------------------------------- 5. a seller who cannot be paid cannot sell
  perform public.upsert_payout_account(seller, 'acct_probe_fees', true, false, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    ord := public.create_order(lst);
    raise exception 'PROBE FAILED: order created for a seller who cannot receive payouts';
  exception when others then
    if sqlerrm <> 'seller_cannot_receive_payouts' then raise; end if;
    results := results || E'5a a pre-existing listing cannot be bought once payouts lapse\n';
  end;

  ------------------------------------------------- 6. the old model is gone
  perform set_config('role', 'postgres', true);
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='orders'
                and column_name in ('fee_cents','fee_payer'))
  then raise exception 'PROBE FAILED: the single-sided fee columns survive'; end if;
  if exists (select 1 from pg_proc where proname='fee_bps')
  then raise exception 'PROBE FAILED: the global fee_bps() function survives'; end if;
  if exists (select 1 from public.platform_flags where key='fee_bps')
  then raise exception 'PROBE FAILED: the fee_bps flag row survives'; end if;
  results := results || E'6a one fee source of truth: the old flag, function and columns are gone\n';

  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
