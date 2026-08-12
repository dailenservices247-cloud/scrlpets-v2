-- The driver's job, and the address reveal.
-- 3a is load-bearing: an unconfirmed job must not leak a seller's home address.
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
  perform public.upsert_payout_account(seller,'acct_tj_s',true,true,true);
  perform public.upsert_payout_account(hauler,'acct_tj_h',true,true,true);
  insert into public.animal_eligibility (creature_id,attested_by,status)
  values (creature,seller,'attested') on conflict (creature_id) do update set status='attested';
  insert into public.identity_verifications (profile_id,status) values (buyer,'verified')
  on conflict (profile_id) do update set status='verified';
  delete from public.seller_programs where profile_id=hauler and program_type='transporter';
  insert into public.seller_programs (profile_id,program_type,status,credential_number,issuing_authority)
  values (hauler,'transporter','approved','APHIS-TJ','USDA APHIS');
  insert into public.services (owner_id,name,category,price_cents,active)
  values (hauler,'PROBE tj haul','transport',15000,true) returning id into svc;
  insert into public.transport_coverage (service_id,region_code) values (svc,'OH'),(svc,'MI');
  insert into public.listings (seller_id,title,price_cents,creature_id,availability)
  values (seller,'PROBE tj listing',200000,creature,'available') returning id into lst;

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.create_order(lst, svc, 'OH', 'MI');

  ------------------------------------------- 1. each party writes only their own
  perform public.set_order_addresses(ord, null, null, '9 Buyer Lane, Detroit MI', '555-0102');
  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  perform public.set_order_addresses(ord, '1 Kennel Road, Columbus OH', '555-0101', null, null);
  perform set_config('role','postgres',true);
  select pickup_address || '|' || delivery_address into got from public.orders where id = ord;
  if got <> '1 Kennel Road, Columbus OH|9 Buyer Lane, Detroit MI' then
    raise exception 'PROBE FAILED: addresses stored as %', got;
  end if;
  results := results || E'1a seller writes pickup, buyer writes delivery\n';

  -- a buyer cannot rewrite the seller's pickup address
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.set_order_addresses(ord, 'HIJACKED', null, null, null);
  perform set_config('role','postgres',true);
  select pickup_address into got from public.orders where id = ord;
  if got <> '1 Kennel Road, Columbus OH' then
    raise exception 'PROBE FAILED: the buyer rewrote the seller''s pickup address';
  end if;
  results := results || E'1b a buyer cannot rewrite where the animal is collected from\n';

  ------------------------------------------- 2. addresses are not column-readable
  perform set_config('request.jwt.claims',
    json_build_object('sub',hauler,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    select pickup_address into got from public.orders where id = ord;
    raise exception 'PROBE FAILED: the driver selected the address column directly';
  exception when insufficient_privilege then
    results := results || E'2a addresses are not selectable by any client role\n';
  end;

  ------------------------------------------- 3. THE REVEAL
  select addresses_visible::text into got from public.my_transport_jobs() where order_id = ord;
  if got <> 'false' then raise exception 'PROBE FAILED: addresses visible pre-capture'; end if;
  select count(*) into n from public.my_transport_jobs()
   where order_id = ord and pickup_address is null and delivery_address is null;
  if n <> 1 then raise exception 'PROBE FAILED: a home address leaked before the money was captured'; end if;
  results := results || E'3a job visible, addresses HIDDEN until the money is captured\n';

  perform set_config('role','postgres',true);
  -- Derived, not hardcoded: due is price + transport + buyer fee, and a
  -- hardcoded number silently leaves the order short of funds_held.
  perform public.record_order_payment(ord,'full',public.order_due_cents(ord),'pi_probe_tj');
  select status into got from public.orders where id = ord;
  if got <> 'funds_held' then
    raise exception 'PROBE INVALID: order is % after full payment, so the reveal is untested', got;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub',hauler,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select pickup_address into got from public.my_transport_jobs() where order_id = ord;
  if got <> '1 Kennel Road, Columbus OH' then
    raise exception 'PROBE FAILED: addresses still hidden after capture (%)', coalesce(got,'<null>');
  end if;
  results := results || E'3b once captured, the driver gets both addresses and contacts\n';

  ------------------------------------------- 4. only the assigned driver
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  select count(*) into n from public.my_transport_jobs() where order_id = ord;
  if n <> 0 then raise exception 'PROBE FAILED: a non-driver saw the job list'; end if;
  results := results || E'4a only the assigned driver sees the job\n';

  ------------------------------------------- 5. no address, no custody
  perform set_config('role','postgres',true);
  select status into got from public.orders where id = ord;
  if got <> 'funds_held' then
    raise exception 'PROBE INVALID: expected funds_held before the pickup check, got %', got;
  end if;
  update public.orders set delivery_address = null where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.confirm_pickup(ord,'E2E-SCAN-1785609244660');
    raise exception 'PROBE FAILED: an animal was collected with nowhere to deliver it';
  exception when others then
    if sqlerrm <> 'delivery_address_required' then raise; end if;
    results := results || E'5a no delivery address: the animal does not leave the property\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
