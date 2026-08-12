-- Three people, one animal, one thread. Membership derived from the order.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  hauler uuid; stranger uuid; lst uuid; ord uuid; got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  select id into hauler from public.profiles where id not in (seller,buyer) limit 1;
  select id into stranger from public.profiles where id not in (seller,buyer,hauler) limit 1;

  insert into public.listings (seller_id,title,price_cents,availability)
  values (seller,'PROBE thread listing',100000,'available') returning id into lst;
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,status)
  values (buyer,seller,lst,100000,'funds_held') returning id into ord;

  ------------------------------------------- 1. buyer and seller can talk
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.post_order_message(ord,'When can I collect?');
  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  perform public.post_order_message(ord,'Saturday morning works.');
  select count(*) into n from public.order_thread(ord);
  if n <> 2 then raise exception 'PROBE FAILED: thread has % messages', n; end if;
  results := results || E'1a buyer and seller share one thread on the order\n';

  ------------------------------------------- 2. a stranger is nowhere near it
  perform set_config('request.jwt.claims',
    json_build_object('sub',stranger,'role','authenticated')::text,true);
  select count(*) into n from public.order_thread(ord);
  if n <> 0 then raise exception 'PROBE FAILED: a stranger read the thread'; end if;
  select count(*) into n from public.order_messages where order_id = ord;
  if n <> 0 then raise exception 'PROBE FAILED: a stranger read the messages table directly'; end if;
  results := results || E'2a a stranger reads nothing, through the function or the table\n';

  begin
    perform public.post_order_message(ord,'let me in');
    raise exception 'PROBE FAILED: a stranger posted into the thread';
  exception when others then
    if sqlerrm <> 'not_a_party' then raise; end if;
    results := results || E'2b and cannot post into it\n';
  end;

  ------------------------------------------- 3. the driver joins by being booked
  perform set_config('role','postgres',true);
  update public.orders set transporter_id = hauler, fulfilment = 'transported',
                           transport_cents = 5000,
                           pickup_region = 'OH', delivery_region = 'MI'
   where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',hauler,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*) into n from public.order_thread(ord);
  if n <> 2 then raise exception 'PROBE FAILED: the booked driver sees % messages', n; end if;
  results := results || E'3a a driver booked LATER joins automatically — membership is derived, not stored\n';

  perform public.post_order_message(ord,'Running about two hours late.');
  select count(*) into n from public.order_thread(ord);
  if n <> 3 then raise exception 'PROBE FAILED: driver message not in the thread'; end if;
  -- Selected by BODY, not by "the last one". now() is transaction-constant, so
  -- every message in this probe shares a created_at and "last" is arbitrary.
  select sender_role into got from public.order_thread(ord)
   where body = 'Running about two hours late.';
  if got <> 'transporter' then raise exception 'PROBE FAILED: driver labelled %', got; end if;
  results := results || E'3b the driver can finally say they are late, labelled as the transporter\n';

  ------------------------------------------- 4. nobody speaks as somebody else
  begin
    insert into public.order_messages (order_id, sender_id, body)
    values (ord, seller, 'I never said this');
    raise exception 'PROBE FAILED: a party posted a message attributed to someone else';
  exception when insufficient_privilege then
    results := results || E'4a cannot post AS another party — in a dispute that is forged evidence\n';
  end;

  ------------------------------------------- 5. the thread is evidence
  perform set_config('role','authenticated',true);
  update public.order_messages set body = 'edited later' where order_id = ord;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'PROBE FAILED: a message was edited after the fact'; end if;
  delete from public.order_messages where order_id = ord;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'PROBE FAILED: a message was deleted'; end if;
  results := results || E'5a append-only: no edits, no deletes — it is dispute evidence\n';

  ------------------------------------------- 6. talking survives a dispute
  perform set_config('role','postgres',true);
  update public.orders set status = 'disputed' where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.post_order_message(ord,'Raising this with support.');
  select count(*) into n from public.order_thread(ord);
  if n <> 4 then raise exception 'PROBE FAILED: cannot talk during a dispute'; end if;
  results := results || E'6a a dispute does NOT silence the thread — that is when talking matters most\n';

  perform set_config('role','postgres',true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
