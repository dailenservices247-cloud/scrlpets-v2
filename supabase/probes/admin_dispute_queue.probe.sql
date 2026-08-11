-- The adjudicator can see the case; nobody else can.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  admin  uuid := '911e7e22-0eae-437f-b402-2d7fdd6f630f';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  lst uuid; ord uuid; got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled = true where key='payments_enabled';
  insert into public.listings (seller_id,title,price_cents,creature_id,availability)
  values (seller,'PROBE dispute',300000,creature,'available') returning id into lst;
  insert into public.listing_guarantees (listing_id, kind, template_key)
  values (lst,'template','congenital_1y_refund');
  insert into public.orders (buyer_id,seller_id,listing_id,title_snapshot,amount_cents,
                             deposit_cents,transport_cents,fulfilment,status,handover_at)
  values (buyer,seller,lst,'PROBE dispute',300000,30000,0,'in_person','inspection',now())
  returning id into ord;
  insert into public.order_events (order_id,actor_id,from_status,to_status,note)
  values (ord,seller,'dispatched','inspection','code and anchor verified');

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.dispute_order(ord,'animal has a heart murmur');

  ------------------------------------------- 1. only an admin sees the queue
  select count(*) into n from public.admin_dispute_queue();
  if n <> 0 then raise exception 'PROBE FAILED: a BUYER saw the dispute queue (% rows)', n; end if;
  results := results || E'1a a party to the order cannot read the adjudication queue\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  select count(*) into n from public.admin_dispute_queue();
  if n <> 0 then raise exception 'PROBE FAILED: a SELLER saw the dispute queue'; end if;
  results := results || E'1b nor the seller\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',admin,'role','authenticated')::text,true);
  select count(*) into n from public.admin_dispute_queue() where order_id = ord;
  if n <> 1 then raise exception 'PROBE FAILED: the admin cannot see the dispute'; end if;
  results := results || E'1c the adjudicator sees it — which RLS alone forbade\n';

  ------------------------------------------- 2. the evidence package is complete
  select dispute_reason into got from public.admin_dispute_queue() where order_id = ord;
  if got is distinct from 'animal has a heart murmur' then
    raise exception 'PROBE FAILED: dispute reason came back as %', coalesce(got,'<null>');
  end if;
  results := results || E'2a the reason the buyer gave is on the case file\n';

  select anchor_verified::text into got from public.admin_dispute_queue() where order_id = ord;
  if got <> 'true' then raise exception 'PROBE FAILED: anchor evidence missing'; end if;
  results := results || E'2b the anchor scan is derived from the append-only trail\n';

  select guarantee_branch into got from public.admin_dispute_queue() where order_id = ord;
  if got <> 'guarantee_refund_on_return' then
    raise exception 'PROBE FAILED: guarantee branch = %', coalesce(got,'<null>');
  end if;
  results := results || E'2c the SELLER''S OWN published remedy is shown, not one chosen by the adjudicator\n';

  ------------------------------------------- 3. the trail, admin-only
  select count(*) into n from public.admin_order_events(ord);
  if n < 2 then raise exception 'PROBE FAILED: event trail has % rows', n; end if;
  results := results || E'3a the full event trail is available for the case\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  select count(*) into n from public.admin_order_events(ord);
  if n <> 0 then raise exception 'PROBE FAILED: a buyer read the admin event trail'; end if;
  results := results || E'3b a party cannot read the admin trail\n';

  ------------------------------------------- 4. deciding still requires admin
  begin
    perform public.settle_order(ord,'guarantee_refund_on_return','probe');
    raise exception 'PROBE FAILED: a buyer settled their own dispute';
  exception when others then
    if sqlerrm <> 'not_permitted' then raise; end if;
    results := results || E'4a seeing and deciding are separate: a party can do neither\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
