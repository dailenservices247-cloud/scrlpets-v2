-- Booking transport with the order: both gates re-checked, route verified,
-- and the platform's cut never touches the driver's fee.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  hauler uuid; lst uuid; svc uuid; ord uuid; got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  select id into hauler from public.profiles where id not in (seller,buyer) limit 1;

  perform public.upsert_payout_account(seller,'acct_bt_seller',true,true,true);
  perform public.upsert_payout_account(hauler,'acct_bt_hauler',true,true,true);
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (creature, seller, 'attested') on conflict (creature_id) do update set status='attested';
  insert into public.identity_verifications (profile_id,status) values (buyer,'verified')
  on conflict (profile_id) do update set status='verified';
  delete from public.seller_programs where profile_id=hauler and program_type='transporter';
  insert into public.seller_programs (profile_id,program_type,status,credential_number,issuing_authority)
  values (hauler,'transporter','approved','APHIS-BT-1','USDA APHIS');

  insert into public.services (owner_id,name,category,price_cents,active)
  values (hauler,'PROBE haul','transport',12000,true) returning id into svc;
  insert into public.transport_coverage (service_id,region_code) values (svc,'OH'),(svc,'MI');

  insert into public.listings (seller_id,title,price_cents,creature_id,availability)
  values (seller,'PROBE bt listing',200000,creature,'available') returning id into lst;

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  ------------------------------------------- 1. a covered route books cleanly
  ord := public.create_order(lst, svc, 'OH', 'MI');
  perform set_config('role','postgres',true);
  select fulfilment || '/' || transporter_id::text || '/' || transport_cents || '/' ||
         pickup_region || '/' || delivery_region
    into got from public.orders where id = ord;
  if got <> 'transported/' || hauler::text || '/12000/OH/MI' then
    raise exception 'PROBE FAILED: booked order is %', got;
  end if;
  results := results || E'1a a covered route books: transported, driver attached, fee and route stored\n';

  -- the platform's cut is on the ANIMAL only
  select buyer_fee_cents || '/' || seller_fee_cents into got from public.orders where id = ord;
  if got <> '6000/10000' then
    raise exception 'PROBE FAILED: fees % — expected 3%% and 5%% of the ANIMAL price only', got;
  end if;
  results := results || E'1b fees are on the animal, never a cut of the driver''s fee\n';

  -- and the buyer owes price + transport + buyer fee
  select public.order_due_cents(ord) into n;
  if n <> 200000 + 12000 + 6000 then
    raise exception 'PROBE FAILED: due % (want 218000)', n;
  end if;
  results := results || E'1c the buyer owes price + transport + their own fee\n';

  ------------------------------------------- 2. the route is verified server-side
  perform set_config('role','authenticated',true);
  begin
    ord := public.create_order(lst, svc, 'OH', 'CA');
    raise exception 'PROBE FAILED: booked a route the driver cannot finish';
  exception when others then
    if sqlerrm <> 'route_not_covered' then raise; end if;
    results := results || E'2a an uncovered leg is refused even if the UI offered it\n';
  end;

  begin
    ord := public.create_order(lst, svc, null, null);
    raise exception 'PROBE FAILED: transport booked with no route';
  exception when others then
    if sqlerrm <> 'route_required' then raise; end if;
    results := results || E'2b transport with no route is refused\n';
  end;

  ------------------------------------------- 3. both gates re-checked at booking
  perform set_config('role','postgres',true);
  perform public.upsert_payout_account(hauler,'acct_bt_hauler',true,false,true);
  perform set_config('role','authenticated',true);
  begin
    ord := public.create_order(lst, svc, 'OH', 'MI');
    raise exception 'PROBE FAILED: booked a driver who lost payouts between browsing and buying';
  exception when others then
    if sqlerrm <> 'transporter_not_bookable' then raise; end if;
    results := results || E'3a payouts revoked mid-checkout: refused at booking, not inherited from the page\n';
  end;
  perform set_config('role','postgres',true);
  perform public.upsert_payout_account(hauler,'acct_bt_hauler',true,true,true);

  ------------------------------------------- 4. a party cannot be the driver
  perform set_config('role','postgres',true);
  insert into public.services (owner_id,name,category,price_cents,active)
  values (seller,'PROBE self haul','transport',9000,true) returning id into svc;
  insert into public.transport_coverage (service_id,region_code) values (svc,'OH'),(svc,'MI');
  insert into public.seller_programs (profile_id,program_type,status,credential_number,issuing_authority)
  values (seller,'transporter','approved','APHIS-BT-2','USDA APHIS');
  perform set_config('role','authenticated',true);
  begin
    ord := public.create_order(lst, svc, 'OH', 'MI');
    raise exception 'PROBE FAILED: the SELLER transported their own sale';
  exception when others then
    if sqlerrm <> 'transporter_cannot_be_a_party' then raise; end if;
    results := results || E'4a a party to the sale cannot also be the independent driver\n';
  end;

  ------------------------------------------- 5. no transport still works
  perform set_config('role','authenticated',true);
  ord := public.create_order(lst);
  perform set_config('role','postgres',true);
  select fulfilment || '/' || transport_cents into got from public.orders where id = ord;
  if got <> 'in_person/0' then raise exception 'PROBE FAILED: plain order is %', got; end if;
  results := results || E'5a an order with no transport is still in_person with no fee\n';

  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
