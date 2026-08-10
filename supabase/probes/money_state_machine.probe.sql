-- Probes the REAL operations, in one transaction that is rolled back.
-- Every expected failure is asserted by error code, not by an empty result.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  crt    uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  admin  uuid := '911e7e22-0eae-437f-b402-2d7fdd6f630f';
  lst    uuid;
  ord    uuid;
  code   text;
  got    text;
  n      integer;
  results text := '';
begin
  -- flag ON for the duration of this (rolled back) transaction
  update public.platform_flags set enabled = true where key = 'payments_enabled';

  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE cockatiel', 50000, crt, 'available')
  returning id into lst;

  insert into public.orders (buyer_id, seller_id, listing_id, title_snapshot,
                             amount_cents, deposit_cents, transport_cents)
  values (buyer, seller, lst, 'PROBE cockatiel', 50000, 10000, 8000)
  returning id into ord;

  ---------------------------------------------------------------- 1. the hole
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.advance_order(ord, 'awaiting_payment', 'probe');
  results := results || E'1a advance draft->awaiting_payment as buyer: OK\n';

  begin
    perform public.advance_order(ord, 'funds_held', 'probe');
    raise exception 'PROBE FAILED: buyer still reached funds_held via advance_order';
  exception when others then
    if sqlerrm <> 'invalid_transition' then raise; end if;
    results := results || E'1b buyer CANNOT self-declare funds_held: invalid_transition\n';
  end;

  begin
    perform public.mark_funds_held(ord, 'pi_probe');
    raise exception 'PROBE FAILED: authenticated executed mark_funds_held';
  exception when insufficient_privilege then
    results := results || E'1c authenticated CANNOT execute mark_funds_held: permission denied\n';
  end;

  ------------------------------------------------------- 2. capture, then code
  perform set_config('role', 'postgres', true);
  perform public.mark_funds_held(ord, 'pi_probe_123');
  select status into got from public.orders where id = ord;
  if got <> 'funds_held' then raise exception 'PROBE FAILED: status % after capture', got; end if;
  select handover_code into code from public.orders where id = ord;
  if code is null or length(code) <> 6 then
    raise exception 'PROBE FAILED: code not minted (%)', code;
  end if;
  results := results || E'2a service role captured -> funds_held, 6-char code minted\n';

  -- seller must not be able to read the column at all
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    select handover_code into got from public.orders where id = ord;
    raise exception 'PROBE FAILED: seller read handover_code column';
  exception when insufficient_privilege then
    results := results || E'2b seller CANNOT read handover_code column: permission denied\n';
  end;

  select public.my_handover_code(ord) into got;
  if got is not null then raise exception 'PROBE FAILED: seller got code via my_handover_code'; end if;
  results := results || E'2c my_handover_code returns null to the seller\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  select public.my_handover_code(ord) into got;
  if got is distinct from code then raise exception 'PROBE FAILED: buyer could not read own code'; end if;
  results := results || E'2d buyer reads own code\n';

  ------------------------------------------------------ 3. dispatch needs cash
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform public.mark_dispatched(ord, 'probe dispatch');
  select status into got from public.orders where id = ord;
  if got <> 'dispatched' then raise exception 'PROBE FAILED: not dispatched (%)', got; end if;
  results := results || E'3a seller dispatched from funds_held\n';

  ------------------------------------------------- 4. code AND anchor required
  begin
    perform public.confirm_handover_and_hold(ord, 'WRONGX', 'E2E-SCAN-1785609244660');
    raise exception 'PROBE FAILED: wrong code accepted';
  exception when others then
    if sqlerrm <> 'code_mismatch' then raise; end if;
    results := results || E'4a wrong code rejected: code_mismatch\n';
  end;

  begin
    perform public.confirm_handover_and_hold(ord, code, 'NOT-THIS-ANIMAL');
    raise exception 'PROBE FAILED: wrong anchor accepted';
  exception when others then
    if sqlerrm <> 'anchor_mismatch' then raise; end if;
    results := results || E'4b wrong anchor rejected: anchor_mismatch (distinct from code error)\n';
  end;

  -- anchor typed in a different format must still match
  perform public.confirm_handover_and_hold(ord, lower(code), 'e2e scan 1785609244660');
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then raise exception 'PROBE FAILED: not in inspection (%)', got; end if;
  results := results || E'4c code + reformatted anchor accepted -> inspection, window set\n';

  select extract(epoch from (inspection_ends_at - handover_at))/3600 into n
    from public.orders where id = ord;
  if n < 24 then raise exception 'PROBE FAILED: inspection window % hours', n; end if;
  results := results || E'4d inspection window >= 24h\n';

  ------------------------------------------------------------- 5. buyer accepts
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform public.accept_delivery(ord);
  select status into got from public.orders where id = ord;
  if got <> 'released' then raise exception 'PROBE FAILED: not released (%)', got; end if;
  results := results || E'5a buyer accepted -> released\n';

  ---------------------------------------------------- 6. the settlement branches
  -- §1 refusal without cause: price back, deposit forfeit, transport NOT refunded
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             deposit_cents, transport_cents, status)
  values (buyer, seller, lst, 50000, 10000, 8000, 'inspection') returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.settle_order(ord, 'refusal_no_cause', 'probe');
    raise exception 'PROBE FAILED: non-admin settled an order';
  exception when others then
    if sqlerrm <> 'not_permitted' then raise; end if;
    results := results || E'6a non-admin CANNOT settle: not_permitted\n';
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'refusal_no_cause', 'probe');
  perform set_config('role', 'postgres', true);
  select refund_price_cents || '/' || refund_deposit_cents || '/' || refund_transport_cents
    into got from public.orders where id = ord;
  if got is null then raise exception 'PROBE FAILED: settlement columns are NULL (order unreadable or unsettled)'; end if;
  if got <> '50000/0/0' then raise exception 'PROBE FAILED: §1 split was % (want 50000/0/0)', got; end if;
  results := results || E'6b §1 refusal_no_cause -> price 50000, deposit 0, transport 0\n';

  -- §3 wrong animal: everything back
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             deposit_cents, transport_cents, status)
  values (buyer, seller, lst, 50000, 10000, 8000, 'dispatched') returning id into ord;
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'wrong_animal', 'probe');
  perform set_config('role', 'postgres', true);
  select refund_price_cents || '/' || refund_deposit_cents || '/' || refund_transport_cents
    into got from public.orders where id = ord;
  if got is null then raise exception 'PROBE FAILED: settlement columns are NULL (order unreadable or unsettled)'; end if;
  if got <> '50000/10000/8000' then raise exception 'PROBE FAILED: §3 split was %', got; end if;
  results := results || E'6c §3 wrong_animal -> full refund incl. deposit and transport\n';

  -- §4 not covered: nothing refunded, funds release to the seller
  perform set_config('role', 'postgres', true);
  insert into public.orders (buyer_id, seller_id, listing_id, amount_cents,
                             deposit_cents, transport_cents, status)
  values (buyer, seller, lst, 50000, 10000, 8000, 'disputed') returning id into ord;
  perform set_config('role', 'authenticated', true);
  perform public.settle_order(ord, 'guarantee_not_covered', 'probe');
  perform set_config('role', 'postgres', true);
  select status || ' ' || refund_price_cents || '/' || refund_deposit_cents || '/' || refund_transport_cents
    into got from public.orders where id = ord;
  if got is null then raise exception 'PROBE FAILED: settlement columns are NULL'; end if;
  if got <> 'released 0/0/0' then raise exception 'PROBE FAILED: §4-not-covered was %', got; end if;
  results := results || E'6d §4 guarantee_not_covered -> released, nothing refunded\n';

  ------------------------------------------------- 7. the flag is the real gate
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.mark_dispatched(ord, 'probe');
    raise exception 'PROBE FAILED: money moved with payments_enabled off';
  exception when others then
    if sqlerrm <> 'payments_disabled' then raise; end if;
    results := results || E'7a flag off -> payments_disabled\n';
  end;

  perform set_config('role', 'postgres', true);
  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
