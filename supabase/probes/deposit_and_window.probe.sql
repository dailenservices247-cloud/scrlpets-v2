-- Deposit and window are seller-set, capped, and FROZEN at order creation.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000011';
  buyer    uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  lst uuid; ord uuid; got text; n integer; results text := '';
begin
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  perform public.upsert_payout_account(seller, 'acct_probe_dw', true, true, true);
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (creature, seller, 'attested') on conflict (creature_id) do update set status='attested';
  insert into public.identity_verifications (profile_id, status) values (buyer, 'verified')
  on conflict (profile_id) do update set status='verified';

  ------------------------------------------------------------ 1. the ceilings
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE dw', 200000, creature, 'available') returning id into lst;

  begin
    update public.listings set deposit_bps = 9000 where id = lst;
    raise exception 'PROBE FAILED: a 90%% deposit was accepted — escrow would be empty';
  exception when check_violation then
    results := results || E'1a deposit above 25%: refused — the escrow must still have something to return\n';
  end;

  begin
    update public.listings set inspection_hours = 12 where id = lst;
    raise exception 'PROBE FAILED: window shortened below the 24h floor';
  exception when check_violation then
    results := results || E'1b window below 24h: refused — a seller may extend, never waive\n';
  end;

  begin
    update public.listings set inspection_hours = 4320 where id = lst;
    raise exception 'PROBE FAILED: a six-month window was accepted';
  exception when check_violation then
    results := results || E'1c window beyond 14 days: refused — no funds parked indefinitely\n';
  end;

  ---------------------------------------- 2. what the seller sets reaches the order
  update public.listings set deposit_bps = 2000, inspection_hours = 72 where id = lst;
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(lst);
  perform set_config('role', 'postgres', true);
  select deposit_cents || '/' || inspection_hours into got from public.orders where id = ord;
  if got <> '40000/72' then
    raise exception 'PROBE FAILED: order took % (want 40000/72 — 20%% of 200000, 72h)', got;
  end if;
  results := results || E'2a 20% deposit on $2000 = $400, 72h window, both carried onto the order\n';

  -- the deposit is a PORTION of the price, so the buyer still owes only the price
  select public.order_due_cents(ord) into n;
  if n <> 200000 + (select buyer_fee_cents from public.orders where id = ord) then
    raise exception 'PROBE FAILED: due % double-counts the deposit', n;
  end if;
  results := results || E'2b the deposit is a PORTION of the price — the buyer is not charged extra\n';

  ------------------------------------------------- 3. frozen against later edits
  update public.listings set deposit_bps = 500, inspection_hours = 240 where id = lst;
  select deposit_cents || '/' || inspection_hours into got from public.orders where id = ord;
  if got <> '40000/72' then
    raise exception 'PROBE FAILED: editing the listing rewrote a live order to %', got;
  end if;
  results := results || E'3a editing the listing afterwards does NOT rewrite a sale already underway\n';

  ------------------------------------------------------ 4. defaults stay honest
  perform set_config('role', 'postgres', true);
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE dw default', 100000, creature, 'available') returning id into lst;
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(lst);
  perform set_config('role', 'postgres', true);
  select deposit_cents || '/' || inspection_hours into got from public.orders where id = ord;
  if got <> '0/24' then
    raise exception 'PROBE FAILED: default listing produced % (want 0/24)', got;
  end if;
  results := results || E'4a a seller who sets nothing: no deposit, 24h floor\n';

  update public.platform_flags set enabled = false where key = 'payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;
select msg from probe_out;
rollback;
