-- Probes that a buyer cannot end up holding both the animal and the money.
-- 4a is the load-bearing assertion.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000011';
  buyer    uuid := '00000000-0000-0000-0000-000000000001';
  admin    uuid := '911e7e22-0eae-437f-b402-2d7fdd6f630f';
  hauler   uuid;
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  lst      uuid;
  ord      uuid;
  code     text;
  got      text;
  n        integer;
  results  text := '';
begin
  select id into hauler from public.profiles where id not in (seller, buyer, admin) limit 1;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE protection', 200000, creature, 'available') returning id into lst;

  -- ============================ 1. two-point custody, matched to who can do what
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, transport_cents,
                             transporter_id, fulfilment, status)
  values (buyer, seller, lst, 200000, 8000, hauler, 'transported', 'awaiting_payment')
  returning id into ord;
  perform public.record_order_payment(ord, 'full', 208000, 'pi_probe_prot1');
  select handover_code into code from public.orders where id = ord;

  -- the transporter cannot release the animal to themselves
  perform set_config('request.jwt.claims',
    json_build_object('sub', hauler, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.confirm_pickup(ord, 'E2E-SCAN-1785609244660');
    raise exception 'PROBE FAILED: transporter released the animal to themselves';
  exception when others then
    if sqlerrm <> 'not_the_seller' then raise; end if;
    results := results || E'1a only the SELLER can release at pickup\n';
  end;

  -- a wrong anchor stops the journey before it starts
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_pickup(ord, 'NOT-THIS-ANIMAL');
    raise exception 'PROBE FAILED: wrong animal loaded into the van';
  exception when others then
    if sqlerrm <> 'anchor_mismatch' then raise; end if;
    results := results || E'1b wrong anchor at pickup: refused before the animal moves\n';
  end;

  perform public.confirm_pickup(ord, 'e2e scan 1785609244660');
  select status into got from public.orders where id = ord;
  if got <> 'dispatched' then raise exception 'PROBE FAILED: pickup -> %', got; end if;
  results := results || E'1c seller scans, custody passes -> dispatched\n';

  -- the transporter is owed from the moment they take the animal
  select count(*) into n from public.order_payouts
   where order_id = ord and leg = 'transporter' and status = 'pending';
  if n <> 1 then raise exception 'PROBE FAILED: transporter not owed at pickup'; end if;
  results := results || E'1d transporter is owed from the moment they take custody\n';

  -- ================================ 2. delivery needs the buyer's code, no scanner
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_delivery_with_code(ord, code);
    raise exception 'PROBE FAILED: absent seller confirmed the delivery';
  exception when others then
    if sqlerrm <> 'not_the_transporter' then raise; end if;
    results := results || E'2a the seller cannot confirm a delivery they are not at\n';
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', hauler, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_delivery_with_code(ord, 'WRONGX');
    raise exception 'PROBE FAILED: wrong code accepted at delivery';
  exception when others then
    if sqlerrm <> 'code_mismatch' then raise; end if;
    results := results || E'2b wrong code at the door: refused\n';
  end;

  perform public.confirm_delivery_with_code(ord, lower(code));
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then raise exception 'PROBE FAILED: delivery -> %', got; end if;
  results := results || E'2c transporter enters the buyer''s code — no scanner needed\n';

  -- ==================================================== 3. transport follows custody
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, transport_cents,
                             transporter_id, fulfilment, status)
  values (buyer, seller, lst, 200000, 8000, hauler, 'transported', 'funds_held')
  returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'no_show_buyer', 'probe');
  perform set_config('role', 'postgres', true);
  select refund_transport_cents into n from public.orders where id = ord;
  if n <> 8000 then
    raise exception 'PROBE FAILED: journey never started but transport refunded % (want 8000)', n;
  end if;
  results := results || E'3a journey never started: transport refunded IN FULL, nobody drove\n';

  -- once picked up, the driver is paid whatever happens at the door
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, transport_cents,
                             transporter_id, fulfilment, status, picked_up_at)
  values (buyer, seller, lst, 200000, 8000, hauler, 'transported', 'inspection', now())
  returning id into ord;
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'refusal_no_cause', 'probe');
  perform set_config('role', 'postgres', true);
  select refund_transport_cents into n from public.orders where id = ord;
  if n <> 0 then
    raise exception 'PROBE FAILED: driver drove but transport refunded % to the buyer', n;
  end if;
  results := results || E'3b buyer refuses at the door: the driver is still paid\n';

  -- ======================= 4. THE HOLE: no unwinding a sale while the buyer has the animal
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, deposit_cents,
                             buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
                             fulfilment, status)
  values (buyer, seller, lst, 200000, 20000, 300, 250, 6000, 5000, 'in_person', 'disputed')
  returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.settle_order(ord, 'guarantee_refund_on_return', 'probe');
    raise exception 'PROBE FAILED: refunded in full while the buyer still has the animal';
  exception when others then
    if sqlerrm <> 'animal_not_returned' then raise; end if;
    results := results || E'4a REFUSED: cannot unwind the sale while the buyer holds the animal\n';
  end;

  -- and the buyer cannot certify their own return
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_animal_returned(ord);
    raise exception 'PROBE FAILED: buyer self-certified the return';
  exception when others then
    if sqlerrm <> 'not_the_seller' then raise; end if;
    results := results || E'4b the BUYER cannot certify that they gave the animal back\n';
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform public.confirm_animal_returned(ord);
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform public.settle_order(ord, 'guarantee_refund_on_return', 'probe');
  perform set_config('role', 'postgres', true);
  select status || ' ' || refund_price_cents into got from public.orders where id = ord;
  if got <> 'refunded 200000' then raise exception 'PROBE FAILED: settled as %', got; end if;
  results := results || E'4c once the seller confirms the animal is BACK, the refund runs\n';

  -- ============================== 5. the other two §4 remedies leave the sale standing
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
                             fulfilment, status)
  values (buyer, seller, lst, 200000, 300, 250, 6000, 5000, 'in_person', 'disputed')
  returning id into ord;
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'guarantee_vet_costs', 'probe', 30000);
  perform set_config('role', 'postgres', true);
  select refund_price_cents || '/' || settled_seller_fee_cents into got from public.orders where id = ord;
  if got <> '30000/5000' then
    raise exception 'PROBE FAILED: vet-cost remedy settled as % (want 30000/5000)', got;
  end if;
  results := results || E'5a vet costs reimbursed from held funds, animal stays, fee stands\n';

  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
                             fulfilment, status)
  values (buyer, seller, lst, 200000, 300, 250, 6000, 5000, 'in_person', 'disputed')
  returning id into ord;
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'guarantee_replacement', 'probe');
  perform set_config('role', 'postgres', true);
  select status || ' ' || refund_price_cents into got from public.orders where id = ord;
  if got <> 'released 0' then raise exception 'PROBE FAILED: replacement settled as %', got; end if;
  results := results || E'5b replacement: funds RELEASE — no money held against a future litter\n';

  -- the unconditional full-refund branch is gone
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             fulfilment, status)
  values (buyer, seller, lst, 200000, 'in_person', 'disputed') returning id into ord;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.settle_order(ord, 'guarantee_upheld', 'probe');
    raise exception 'PROBE FAILED: the unconditional refund branch still exists';
  exception when others then
    if sqlerrm not in ('unknown_branch') and sqlerrm not like '%violates check constraint%' then raise; end if;
    results := results || E'5c the old unconditional guarantee_upheld branch is GONE\n';
  end;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
