-- The buyer's money coming back. 3a is load-bearing: a refund must never race a
-- payout, or the same money is paid twice. 5* is the reason this file was
-- rewritten: a refund spanning a deposit AND a balance charge used to be flagged
-- and then abandoned, because the schema could not hold its second half.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  admin  uuid := '911e7e22-0eae-437f-b402-2d7fdd6f630f';
  lst uuid; ord uuid; rid uuid; leg uuid; got text; n integer; results text := '';
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

  ------------------------------------------- 5. a refund SPANNING two charges is PAID, not stranded
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
  select id into rid from public.order_refunds where order_id = ord;

  -- The whole point. Two charges funded it, so two legs pay it back, and they
  -- add up to every cent owed. This is what used to be flagged and abandoned.
  select count(*) into n from public.order_refund_legs where refund_id = rid;
  if n <> 2 then raise exception 'PROBE FAILED: % legs for a refund spanning two charges (want 2)', n; end if;
  select coalesce(sum(amount_cents),0) into n from public.order_refund_legs where refund_id = rid;
  if n <> 103000 then
    raise exception 'PROBE FAILED: legs sum to % but the buyer is owed 103000 — the remainder is stranded', n;
  end if;
  results := results || E'5a a refund spanning two charges becomes TWO legs summing to the full debt\n';

  select count(*) into n from public.order_refund_legs l
   where l.refund_id = rid and not exists (
     select 1 from public.order_payments p
      where p.order_id = ord and p.status='captured'
        and p.stripe_payment_intent_id = l.stripe_payment_intent_id);
  if n <> 0 then raise exception 'PROBE FAILED: % legs name a charge that was never captured', n; end if;
  results := results || E'5b every leg names a real captured PaymentIntent\n';

  select count(*) into n from public.order_refund_legs l
    join public.order_payments p on p.stripe_payment_intent_id = l.stripe_payment_intent_id
   where l.refund_id = rid and l.amount_cents > p.amount_cents;
  if n <> 0 then
    raise exception 'PROBE FAILED: % legs ask Stripe for more than that charge holds', n;
  end if;
  results := results || E'5c no leg exceeds what its own charge captured\n';

  select count(*) into n from public.pending_refunds() where refund_id = rid;
  if n <> 2 then raise exception 'PROBE FAILED: queue offered % legs (want 2)', n; end if;
  results := results || E'5d both legs are queued for sending\n';

  ------------------------------------------- 5e. owed LESS than captured: deposit stays forfeit
  perform set_config('role','postgres',true);
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,deposit_cents,
                             buyer_fee_cents,seller_fee_cents,status)
  values (buyer,seller,lst,100000,20000,3000,5000,'awaiting_payment') returning id into ord;
  perform public.record_order_payment(ord,'deposit',20000,'pi_rf_d2');
  perform public.record_order_payment(ord,'balance',83000,'pi_rf_b2');
  perform set_config('request.jwt.claims',
    json_build_object('sub',admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  -- §1 refusal without cause: the price comes back MINUS the deposit, which
  -- forfeits to the seller who held the animal off-market.
  perform public.settle_order(ord,'refusal_no_cause','probe refusal');
  perform set_config('role','postgres',true);
  select id into rid from public.order_refunds where order_id = ord;
  select count(*) into n from public.order_refund_legs
   where refund_id = rid and stripe_payment_intent_id = 'pi_rf_d2';
  if n <> 0 then
    raise exception 'PROBE FAILED: §1 refunded the deposit charge — the deposit is forfeit under refusal';
  end if;
  select coalesce(sum(amount_cents),0) into n from public.order_refund_legs where refund_id = rid;
  if n <> 83000 then raise exception 'PROBE FAILED: §1 returned % (want 83000)', n; end if;
  results := results || E'5e §1 refusal draws only on the balance charge — the deposit stays forfeit\n';

  ------------------------------------------- 5f. a debt with NO charge behind it is visible
  perform set_config('role','postgres',true);
  insert into public.orders (buyer_id,seller_id,listing_id,amount_cents,deposit_cents,
                             buyer_fee_cents,seller_fee_cents,status)
  values (buyer,seller,lst,100000,20000,3000,5000,'awaiting_payment') returning id into ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.settle_order(ord,'wrong_animal','probe no charge');
  perform set_config('role','postgres',true);
  select id into rid from public.order_refunds where order_id = ord;
  select count(*) into n from public.pending_refunds() where refund_id = rid;
  if n <> 1 then
    raise exception 'PROBE FAILED: a refund with no captured charge vanished from the queue (% rows)', n;
  end if;
  select payment_intent_id into got from public.pending_refunds() where refund_id = rid;
  if got is not null then raise exception 'PROBE FAILED: invented a charge (%) for an unpaid order', got; end if;
  results := results || E'5f a debt with no captured charge is SURFACED with a null intent, not dropped\n';

  ------------------------------------------- 6. idempotent, partial-proof, client-proof
  select l.id into leg from public.order_refund_legs l
   where l.stripe_payment_intent_id = 'pi_rf_bal' and l.status = 'pending';
  perform public.mark_refund_leg_paid(leg,'re_probe_1');
  perform public.mark_refund_leg_paid(leg,'re_probe_1');
  select count(*) into n from public.order_refund_legs where stripe_refund_id = 're_probe_1';
  if n <> 1 then raise exception 'PROBE FAILED: % legs share a refund id', n; end if;
  results := results || E'6a marking a leg paid twice is safe\n';

  -- One leg of two does NOT settle the debt. This is the short-pay, in schema.
  select r.status into got from public.order_refunds r
    join public.order_refund_legs l on l.refund_id = r.id
   where l.id = leg;
  if got <> 'pending' then
    raise exception 'PROBE FAILED: one leg of two closed the whole debt as %', got;
  end if;
  results := results || E'6b paying ONE leg of two leaves the debt open — no short-pay closes it\n';

  select l.id into leg from public.order_refund_legs l
   where l.stripe_payment_intent_id = 'pi_rf_dep' and l.status = 'pending';
  perform public.mark_refund_leg_paid(leg,'re_probe_2');
  select r.status into got from public.order_refunds r
    join public.order_refund_legs l on l.refund_id = r.id where l.id = leg;
  if got <> 'paid' then raise exception 'PROBE FAILED: both legs paid but the debt reads %', got; end if;
  results := results || E'6c once every leg is paid, the debt closes\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.pending_refunds();
    raise exception 'PROBE FAILED: a buyer enumerated the refund queue';
  exception when insufficient_privilege then
    results := results || E'6d no client role can list or mark refunds\n';
  end;
  begin
    perform count(*) from public.order_refund_legs;
    if found then null; end if;
    select count(*) into n from public.order_refund_legs;
    if n <> 0 then raise exception 'PROBE FAILED: a buyer read % refund legs', n; end if;
    results := results || E'6e refund legs are invisible to a client role\n';
  exception when insufficient_privilege then
    results := results || E'6e refund legs are invisible to a client role\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
