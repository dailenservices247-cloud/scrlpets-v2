-- Probes the deposit-then-balance and multi-party payout paths, rolled back.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000001';
  buyer    uuid := '00000000-0000-0000-0000-000000000011';
  hauler   uuid;
  lst      uuid;
  ord      uuid;
  got      text;
  n        integer;
  pid      uuid;
  pid2     uuid;
  results  text := '';
begin
  select id into hauler from public.profiles
   where id not in (seller, buyer) limit 1;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';

  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE payments listing', 100000, 'available') returning id into lst;

  -- price 100000, deposit 20000 (a PORTION of price), transport 8000
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             deposit_cents, transport_cents, status)
  values (buyer, seller, lst, 100000, 20000, 8000, 'awaiting_payment')
  returning id into ord;

  ------------------------------------------------- 1. due is derived correctly
  select public.order_due_cents(ord) into n;
  if n <> 108000 then
    raise exception 'PROBE FAILED: due = % (want 108000 = price 100000 + transport 8000; deposit is a PORTION of price, not an addition)', n;
  end if;
  results := results || E'1a order_due_cents = 108000 (deposit not double-counted)\n';

  ------------------------------------------- 2. clients cannot book their own money
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.record_order_payment(ord, 'full', 108000, 'pi_selfclaim');
    raise exception 'PROBE FAILED: buyer booked their own payment';
  exception when insufficient_privilege then
    results := results || E'2a authenticated CANNOT execute record_order_payment\n';
  end;
  begin
    insert into public.order_payments (order_id, kind, amount_cents, status)
    values (ord, 'full', 108000, 'captured');
    raise exception 'PROBE FAILED: buyer inserted a payment row directly';
  exception when insufficient_privilege then
    results := results || E'2b no client INSERT policy on order_payments\n';
  end;

  --------------------------------------------------- 3. deposit -> deposit_held
  perform set_config('role', 'postgres', true);
  pid := public.record_order_payment(ord, 'deposit', 20000, 'pi_probe_deposit');
  select status into got from public.orders where id = ord;
  if got <> 'deposit_held' then raise exception 'PROBE FAILED: status % after deposit', got; end if;
  results := results || E'3a deposit captured -> deposit_held\n';

  select handover_code into got from public.orders where id = ord;
  if got is not null then
    raise exception 'PROBE FAILED: handover code minted while only a deposit is down';
  end if;
  results := results || E'3b no handover code yet — a deposit must not release the balance\n';

  -- dispatch must be impossible on a deposit alone
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.mark_dispatched(ord, 'probe');
    raise exception 'PROBE FAILED: animal dispatched against a deposit alone';
  exception when others then
    if sqlerrm <> 'funds_not_held' then raise; end if;
    results := results || E'3c cannot dispatch on a deposit alone: funds_not_held\n';
  end;

  -- a dispute IS raisable against a held deposit (§1 forfeits it)
  perform public.dispute_order(ord, 'probe deposit dispute');
  select status into got from public.orders where id = ord;
  if got <> 'disputed' then raise exception 'PROBE FAILED: deposit dispute -> %', got; end if;
  results := results || E'3d dispute raisable against a held deposit\n';
  perform set_config('role', 'postgres', true);
  update public.orders set status = 'deposit_held' where id = ord;

  ------------------------------------------------ 4. balance -> funds_held
  pid2 := public.record_order_payment(ord, 'balance', 88000, 'pi_probe_balance');
  select status into got from public.orders where id = ord;
  if got <> 'funds_held' then raise exception 'PROBE FAILED: status % after balance', got; end if;
  select public.order_captured_cents(ord) into n;
  if n <> 108000 then raise exception 'PROBE FAILED: captured = %', n; end if;
  results := results || E'4a balance captured -> funds_held, 108000 booked over TWO payments\n';

  select handover_code into got from public.orders where id = ord;
  if got is null or length(got) <> 6 then raise exception 'PROBE FAILED: code not minted at full capture'; end if;
  results := results || E'4b handover code minted only at full capture\n';

  --------------------------------------- 5. redelivered webhook must not double-book
  pid := public.record_order_payment(ord, 'balance', 88000, 'pi_probe_balance');
  if pid <> pid2 then raise exception 'PROBE FAILED: redelivery created a second payment'; end if;
  select public.order_captured_cents(ord) into n;
  if n <> 108000 then raise exception 'PROBE FAILED: redelivery double-booked, captured = %', n; end if;
  results := results || E'5a redelivered webhook returns the same payment, money booked once\n';

  ------------------------------------------------- 6. multi-party payout legs
  perform public.record_order_payout(ord, seller, 'seller', 95000, 'tr_probe_seller');
  perform public.record_order_payout(ord, hauler, 'transporter', 8000, null);
  select count(*) into n from public.order_payouts where order_id = ord;
  if n <> 2 then raise exception 'PROBE FAILED: % payout legs, want 2', n; end if;
  results := results || E'6a one order carries a seller leg AND a transporter leg\n';

  select status into got from public.order_payouts
   where order_id = ord and leg = 'transporter';
  if got <> 'pending' then raise exception 'PROBE FAILED: unsent leg is %, want pending', got; end if;
  results := results || E'6b a leg owed but not yet sent is VISIBLE as pending, not absent\n';

  -- the transporter is neither buyer nor seller and must still see their own leg
  perform set_config('request.jwt.claims',
    json_build_object('sub', hauler, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.order_payouts where order_id = ord;
  if n <> 1 then raise exception 'PROBE FAILED: transporter sees % legs, want their own 1', n; end if;
  results := results || E'6c transporter sees their own leg only, not the seller''s\n';

  select count(*) into n from public.order_payments where order_id = ord;
  if n <> 0 then raise exception 'PROBE FAILED: transporter can read buyer payments'; end if;
  results := results || E'6d transporter CANNOT read what the buyer paid\n';

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
