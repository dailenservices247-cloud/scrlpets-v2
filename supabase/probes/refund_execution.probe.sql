-- The buyer's money coming back. 3a is load-bearing: a refund must never race a
-- payout, or the same money is paid twice.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  admin  uuid := '911e7e22-0eae-437f-b402-2d7fdd6f630f';
  lst uuid; ord uuid; rid uuid; got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform public.upsert_payout_account(seller,'acct_rf_s',true,true,true);

  insert into public.listings (seller_id,title,price_cents,availability)
  values (seller,'PROBE refund',100000,'available') returning id into lst;
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,deposit_cents,
                             buyer_fee_bps,seller_fee_bps,buyer_fee_cents,seller_fee_cents,
                             status)
  values (buyer,seller,lst,100000,20000,300,500,3000,5000,'awaiting_payment')
  returning id into ord;
  perform public.record_order_payment(ord,'full',103000,'pi_rf_1');

  ------------------------------------------- 1. settling creates the debt
  update public.orders set status = 'disputed' where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.settle_order(ord,'wrong_animal','probe');
  perform set_config('role','postgres',true);

  select amount_cents into n from public.order_refunds where order_id = ord;
  -- §3: price 100000 + deposit 20000? No — the deposit is a PORTION of price.
  -- Owed = price + transport + the buyer fee returned in full = 103000.
  if n <> 103000 then
    raise exception 'PROBE FAILED: buyer owed % (want 103000)', n;
  end if;
  results := results || E'1a a §3 settlement creates the refund debt, buyer fee included\n';

  ------------------------------------------- 2. one debt per order
  update public.orders set status = 'disputed' where id = ord;
  perform set_config('role','authenticated',true);
  perform public.settle_order(ord,'wrong_animal','probe again');
  perform set_config('role','postgres',true);
  select count(*) into n from public.order_refunds where order_id = ord;
  if n <> 1 then raise exception 'PROBE FAILED: % refund rows for one order', n; end if;
  results := results || E'2a settling twice does not owe the buyer twice\n';

  ------------------------------------------- 3. never race a payout
  select id into rid from public.order_refunds where order_id = ord;
  perform public.record_order_payout(ord,seller,'seller',95000,'tr_already_sent');
  select count(*) into n from public.pending_refunds() where refund_id = rid;
  if n <> 0 then
    raise exception 'PROBE FAILED: queued a refund while a transfer to the seller stands — that pays twice';
  end if;
  results := results || E'3a a refund is BLOCKED while a payout on that order is unreversed\n';

  perform set_config('role','postgres',true);
  update public.order_payouts set status='reversed' where order_id = ord;
  select count(*) into n from public.pending_refunds() where refund_id = rid;
  if n <> 1 then raise exception 'PROBE FAILED: refund still blocked after the transfer was reversed'; end if;
  results := results || E'3b once reversed, the refund is payable\n';

  ------------------------------------------- 4. it refunds against a real charge
  select payment_intent_id into got from public.pending_refunds() where refund_id = rid;
  if got <> 'pi_rf_1' then raise exception 'PROBE FAILED: refunding against %', coalesce(got,'<null>'); end if;
  results := results || E'4a refunds against the actual captured PaymentIntent\n';

  ------------------------------------------- 5. a split refund is surfaced, not guessed
  perform set_config('role','postgres',true);
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,deposit_cents,
                             buyer_fee_cents,seller_fee_cents,status)
  values (buyer,seller,lst,100000,20000,3000,5000,'awaiting_payment') returning id into ord;
  perform public.record_order_payment(ord,'deposit',20000,'pi_rf_dep');
  perform public.record_order_payment(ord,'balance',83000,'pi_rf_bal');
  update public.orders set status='disputed' where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.settle_order(ord,'wrong_animal','probe split');
  perform set_config('role','postgres',true);
  select needs_manual_split::text into got from public.pending_refunds() where order_id = ord;
  if got <> 'true' then
    raise exception 'PROBE FAILED: a refund spanning two charges was not flagged (%)', coalesce(got,'<null>');
  end if;
  results := results || E'5a a refund larger than any one charge is FLAGGED, not short-paid\n';

  ------------------------------------------- 6. idempotent, and client-proof
  perform public.mark_refund_paid(rid,'re_probe_1');
  perform public.mark_refund_paid(rid,'re_probe_1');
  select count(*) into n from public.order_refunds where stripe_refund_id = 're_probe_1';
  if n <> 1 then raise exception 'PROBE FAILED: % rows share a refund id', n; end if;
  results := results || E'6a marking a refund paid twice is safe\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.pending_refunds();
    raise exception 'PROBE FAILED: a buyer enumerated the refund queue';
  exception when insufficient_privilege then
    results := results || E'6b no client role can list or mark refunds\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
