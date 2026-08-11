-- Probes all THREE release paths, rolled back.
-- 3a is the one that matters most: before this migration a shipped order could
-- never leave `dispatched`.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000011';
  buyer    uuid := '00000000-0000-0000-0000-000000000001';
  hauler   uuid;
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  lst      uuid;
  ord      uuid;
  code     text;
  got      text;
  n        integer;
  results  text := '';
begin
  select id into hauler from public.profiles where id not in (seller, buyer) limit 1;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  -- Guard: every anchor assertion below is SKIPPED by design when the animal has
  -- no anchor registered, so an unanchored fixture would make them all vacuous.
  if not exists (select 1 from public.creatures where id = creature and anchor_value is not null) then
    raise exception 'PROBE INVALID: fixture creature has no anchor — anchor assertions would be vacuous';
  end if;
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE fulfilment', 50000, creature, 'available') returning id into lst;

  -- ======================================================= 1. IN PERSON
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, fulfilment, status)
  values (buyer, seller, lst, 50000, 'in_person', 'awaiting_payment') returning id into ord;
  perform public.record_order_payment(ord, 'full', 50000, 'pi_probe_inperson');
  select handover_code into code from public.orders where id = ord;

  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.mark_dispatched(ord, 'probe');
  perform public.confirm_handover_and_hold(ord, code, 'E2E-SCAN-1785609244660');
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then raise exception 'PROBE FAILED: in_person -> %', got; end if;
  results := results || E'1a in_person: seller confirms code + anchor -> inspection\n';

  -- ======================================================= 2. TRANSPORTED
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, transport_cents,
                             transporter_id, fulfilment, status)
  values (buyer, seller, lst, 50000, 8000, hauler, 'transported', 'awaiting_payment')
  returning id into ord;
  perform public.record_order_payment(ord, 'full', 58000, 'pi_probe_transported');
  select handover_code into code from public.orders where id = ord;

  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.mark_dispatched(ord, 'probe');

  -- the SELLER is not at the delivery and must not be able to attest to it
  begin
    perform public.confirm_handover_and_hold(ord, code, 'E2E-SCAN-1785609244660');
    raise exception 'PROBE FAILED: absent seller confirmed a transported handover';
  exception when others then
    if sqlerrm <> 'not_the_handover_agent' then raise; end if;
    results := results || E'2a transported: SELLER cannot confirm — they are not there\n';
  end;

  -- the buyer holds the code; letting them confirm proves nothing
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_handover_and_hold(ord, code, 'E2E-SCAN-1785609244660');
    raise exception 'PROBE FAILED: buyer confirmed their own handover';
  exception when others then
    if sqlerrm <> 'not_the_handover_agent' then raise; end if;
    results := results || E'2b transported: BUYER cannot confirm — they hold the code\n';
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', hauler, 'role', 'authenticated')::text, true);
  perform public.confirm_handover_and_hold(ord, code, 'e2e scan 1785609244660');
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then raise exception 'PROBE FAILED: transported -> %', got; end if;
  results := results || E'2c transported: TRANSPORTER confirms at the door -> inspection\n';

  -- ======================================================= 3. SHIPPED
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, fulfilment, status)
  values (buyer, seller, lst, 50000, 'shipped', 'awaiting_payment') returning id into ord;
  perform public.record_order_payment(ord, 'full', 50000, 'pi_probe_shipped');
  select handover_code into code from public.orders where id = ord;

  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    perform public.mark_dispatched(ord, 'probe');
    raise exception 'PROBE FAILED: shipped order dispatched without tracking';
  exception when others then
    if sqlerrm <> 'use_record_shipment' then raise; end if;
    results := results || E'3a shipped: mark_dispatched refused — tracking is mandatory\n';
  end;

  begin
    perform public.record_shipment(ord, 'UPS', '   ');
    raise exception 'PROBE FAILED: blank tracking accepted';
  exception when others then
    if sqlerrm <> 'tracking_required' then raise; end if;
    results := results || E'3b shipped: blank tracking refused\n';
  end;

  perform public.record_shipment(ord, 'UPS', '1Z-PROBE-999');
  select status into got from public.orders where id = ord;
  if got <> 'dispatched' then raise exception 'PROBE FAILED: shipped -> %', got; end if;
  results := results || E'3c shipped: record_shipment -> dispatched with tracking stored\n';

  -- a shipped order has no meeting; confirming one would fabricate it
  begin
    perform public.confirm_handover_and_hold(ord, code, 'anything');
    raise exception 'PROBE FAILED: shipped order released via a fabricated handover';
  exception when others then
    if sqlerrm <> 'shipped_orders_confirm_by_delivery' then raise; end if;
    results := results || E'3d shipped: code+anchor path REFUSED — no meeting exists\n';
  end;

  -- the seller must not be able to declare their own parcel delivered
  begin
    perform public.confirm_shipment_delivered(ord);
    raise exception 'PROBE FAILED: seller confirmed their own delivery';
  exception when insufficient_privilege then
    results := results || E'3e shipped: seller CANNOT declare delivery — that is the carrier''s word\n';
  end;

  perform set_config('role', 'postgres', true);
  perform public.confirm_shipment_delivered(ord);
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then raise exception 'PROBE FAILED: delivered -> %', got; end if;
  results := results || E'3f shipped: carrier delivery -> inspection (THIS WAS IMPOSSIBLE BEFORE)\n';

  select extract(epoch from (inspection_ends_at - delivered_at))/3600 into n
    from public.orders where id = ord;
  if n < 24 then raise exception 'PROBE FAILED: live-arrival window % hours', n; end if;
  results := results || E'3g shipped: live-arrival window >= 24h from delivery\n';

  -- ============================================== 4. overdue shipments
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents, fulfilment,
                             status, shipped_at, tracking_number)
  values (buyer, seller, lst, 50000, 'shipped', 'dispatched', now() - interval '15 days', '1Z-LOST')
  returning id into ord;
  select count(*) into n from public.overdue_shipments() where order_id = ord;
  if n <> 1 then raise exception 'PROBE FAILED: overdue shipment not surfaced'; end if;
  results := results || E'4a a shipment 15 days out with no delivery is surfaced for dispute\n';

  -- ============================================== 5. money owed to nobody
  begin
    insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                               transport_cents, fulfilment, status)
    values (buyer, seller, lst, 50000, 8000, 'transported', 'draft');
    raise exception 'PROBE FAILED: transport owed with no transporter';
  exception when check_violation then
    results := results || E'5a transport_cents with no transporter_id is refused\n';
  end;

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
