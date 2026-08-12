-- Money coming OUT. The seller's leg appears on release, is owed until sent,
-- and no client can see or mark it.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  hauler uuid; lst uuid; ord uuid; pid uuid; got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  select id into hauler from public.profiles where id not in (seller,buyer) limit 1;
  perform public.upsert_payout_account(seller,'acct_po_s',true,true,true);
  perform public.upsert_payout_account(hauler,'acct_po_h',true,true,true);

  insert into public.listings (seller_id,title,price_cents,availability)
  values (seller,'PROBE payout',100000,'available') returning id into lst;
  -- $1000 animal, seller fee $50, transport $200 to the hauler
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,
                             seller_fee_bps,seller_fee_cents,buyer_fee_cents,
                             transport_cents,transporter_id,fulfilment,
                             pickup_region,delivery_region,status,picked_up_at)
  values (buyer,seller,lst,100000,500,5000,3000,20000,hauler,'transported',
          'OH','MI','inspection',now())
  returning id into ord;
  perform public.record_order_payout(ord,hauler,'transporter',20000,null);

  ------------------------------------------- 1. nothing is payable pre-release
  select count(*) into n from public.pending_payouts() where order_id = ord;
  if n <> 0 then
    raise exception 'PROBE FAILED: % legs payable before the sale completed', n;
  end if;
  results := results || E'1a nothing is paid out while the order is still in inspection\n';

  ------------------------------------------- 2. release creates the seller's leg
  update public.orders set status = 'released' where id = ord;
  select amount_cents into n from public.order_payouts where order_id = ord and leg = 'seller';
  if n <> 95000 then
    raise exception 'PROBE FAILED: seller owed % (want 95000 = 100000 less the 5000 fee)', n;
  end if;
  results := results || E'2a release owes the seller the price LESS their fee: 95000\n';

  select count(*) into n from public.pending_payouts() where order_id = ord;
  if n <> 2 then raise exception 'PROBE FAILED: % payable legs, want seller + transporter', n; end if;
  results := results || E'2b both legs become payable: the seller and the driver\n';

  ------------------------------------------- 3. released twice, owed once
  update public.orders set status = 'inspection' where id = ord;
  update public.orders set status = 'released' where id = ord;
  select count(*) into n from public.order_payouts where order_id = ord and leg = 'seller';
  if n <> 1 then raise exception 'PROBE FAILED: % seller legs after a second release', n; end if;
  results := results || E'3a a second release does not owe the seller twice\n';

  ------------------------------------------- 4. marking paid is idempotent
  select payout_id into pid from public.pending_payouts() where order_id = ord and leg = 'seller';
  perform public.mark_payout_paid(pid,'tr_probe_1');
  perform public.mark_payout_paid(pid,'tr_probe_1');
  select status into got from public.order_payouts where id = pid;
  if got <> 'paid' then raise exception 'PROBE FAILED: leg is %', got; end if;
  select count(*) into n from public.order_payouts where stripe_transfer_id = 'tr_probe_1';
  if n <> 1 then raise exception 'PROBE FAILED: % rows carry the same transfer id', n; end if;
  results := results || E'4a marking paid twice is safe — a crashed runner can retry\n';

  select count(*) into n from public.pending_payouts() where payout_id = pid;
  if n <> 0 then raise exception 'PROBE FAILED: a paid leg is still queued'; end if;
  results := results || E'4b a paid leg leaves the queue\n';

  ------------------------------------------- 5. an unpayable recipient is not queued
  perform public.upsert_payout_account(hauler,'acct_po_h',true,false,true);
  select count(*) into n from public.pending_payouts() where order_id = ord;
  if n <> 0 then
    raise exception 'PROBE FAILED: queued a transfer to an account that cannot receive it';
  end if;
  results := results || E'5a a recipient whose payouts lapsed is skipped, and stays owed\n';

  ------------------------------------------- 6. no client touches any of it
  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.pending_payouts();
    raise exception 'PROBE FAILED: a seller enumerated the payout queue';
  exception when insufficient_privilege then
    results := results || E'6a no client role can list who is owed what\n';
  end;
  begin
    perform public.mark_payout_paid(pid,'tr_self_paid');
    raise exception 'PROBE FAILED: a seller marked their own payout sent';
  exception when insufficient_privilege then
    results := results || E'6b nor mark their own payout as sent\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
