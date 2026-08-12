-- The amount a charge is allowed to be. The client never supplies it.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  lst uuid; ord uuid; n integer; got text; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform public.upsert_payout_account(seller,'acct_opa',true,true,true);
  insert into public.animal_eligibility (creature_id,attested_by,status)
  values (creature,seller,'attested') on conflict (creature_id) do update set status='attested';
  insert into public.identity_verifications (profile_id,status) values (buyer,'verified')
  on conflict (profile_id) do update set status='verified';

  -- $1000 animal, 20% deposit, 3% buyer fee => due 103000, deposit 20000
  insert into public.listings (seller_id,title,price_cents,creature_id,availability,deposit_bps)
  values (seller,'PROBE opa',100000,creature,'available',2000) returning id into lst;
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.create_order(lst);

  ------------------------------------------- 1. the two kinds
  if public.order_payment_amount(ord,'deposit') <> 20000 then
    raise exception 'PROBE FAILED: deposit is %', public.order_payment_amount(ord,'deposit');
  end if;
  results := results || E'1a a deposit charge is exactly the deposit: $200 of a $1000 animal\n';

  if public.order_payment_amount(ord,'full') <> 103000 then
    raise exception 'PROBE FAILED: full is %', public.order_payment_amount(ord,'full');
  end if;
  results := results || E'1b a full charge is price + buyer fee: 103000, deposit not added on top\n';

  ------------------------------------------- 2. the balance is what remains
  perform set_config('role','postgres',true);
  perform public.record_order_payment(ord,'deposit',20000,'pi_opa_dep');
  perform set_config('role','authenticated',true);
  if public.order_payment_amount(ord,'balance') <> 83000 then
    raise exception 'PROBE FAILED: balance is %', public.order_payment_amount(ord,'balance');
  end if;
  results := results || E'2a after a deposit, the balance is exactly what is still owed\n';

  begin
    perform public.order_payment_amount(ord,'deposit');
    raise exception 'PROBE FAILED: a second deposit was allowed';
  exception when others then
    if sqlerrm <> 'deposit_already_paid' then raise; end if;
    results := results || E'2b the deposit cannot be charged twice\n';
  end;

  ------------------------------------------- 3. paid in full, nothing left
  perform set_config('role','postgres',true);
  perform public.record_order_payment(ord,'balance',83000,'pi_opa_bal');
  select status into got from public.orders where id = ord;
  if got <> 'funds_held' then raise exception 'PROBE FAILED: status % after full payment', got; end if;
  perform set_config('role','authenticated',true);
  begin
    perform public.order_payment_amount(ord,'balance');
    raise exception 'PROBE FAILED: charged again on a fully paid order';
  exception when others then
    if sqlerrm <> 'nothing_left_to_pay' then raise; end if;
    results := results || E'3a a fully paid order refuses another charge\n';
  end;

  ------------------------------------------- 4. only the buyer pays
  perform set_config('request.jwt.claims',
    json_build_object('sub',seller,'role','authenticated')::text,true);
  begin
    perform public.order_payment_amount(ord,'balance');
    raise exception 'PROBE FAILED: the seller could start a charge on their own sale';
  exception when others then
    if sqlerrm <> 'not_the_buyer' then raise; end if;
    results := results || E'4a only the buyer can start a payment\n';
  end;

  ------------------------------------------- 5. a points credit lowers the charge
  perform set_config('role','postgres',true);
  insert into public.listings (seller_id,title,price_cents,creature_id,availability)
  values (seller,'PROBE opa2',100000,creature,'available') returning id into lst;
  perform set_config('request.jwt.claims',
    json_build_object('sub',buyer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.create_order(lst);
  perform set_config('role','postgres',true);
  perform public.award_points(buyer,100000,'probe_grant','order',null);
  perform set_config('role','authenticated',true);
  perform public.redeem_fee_credit(ord, 1500);
  if public.order_payment_amount(ord,'full') <> 103000 - 1500 then
    raise exception 'PROBE FAILED: credit not reflected, charge is %',
      public.order_payment_amount(ord,'full');
  end if;
  results := results || E'5a points spent on the fee reduce what the card is actually charged\n';

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
