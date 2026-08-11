-- Probes the payout rail against the REAL operations, rolled back.
-- The load-bearing assertions are 4a/4b/4c: the gate must be INERT today and
-- must BITE once payments are enabled. Either half failing is a shipped bug.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '00000000-0000-0000-0000-0000000000c3';
  other    uuid := '00000000-0000-0000-0000-000000000011';
  got      text;
  ok       boolean;
  n        integer;
  results  text := '';
begin
  ----------------------------------------------------- 1. nobody can self-grant
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    perform public.upsert_payout_account(seller, 'acct_selfgrant', true, true, true);
    raise exception 'PROBE FAILED: authenticated wrote its own payout account';
  exception when insufficient_privilege then
    results := results || E'1a authenticated CANNOT execute upsert_payout_account\n';
  end;

  select public.can_receive_payouts(seller) into ok;
  if ok then raise exception 'PROBE FAILED: payouts enabled with no account'; end if;
  results := results || E'1b can_receive_payouts = false with no account\n';

  ------------------------------------------------- 2. only Stripe writes, owner reads
  perform set_config('role', 'postgres', true);
  perform public.upsert_payout_account(seller, 'acct_probe_seller', true, true, true);
  perform public.upsert_payout_account(other,  'acct_probe_other',  false, false, false);

  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.seller_payout_accounts;
  if n <> 1 then raise exception 'PROBE FAILED: seller sees % payout rows, want 1', n; end if;
  results := results || E'2a RLS: seller sees only their own payout row\n';

  select stripe_account_id into got from public.my_payout_account();
  if got is distinct from 'acct_probe_seller' then
    raise exception 'PROBE FAILED: my_payout_account returned %', got;
  end if;
  results := results || E'2b my_payout_account returns the owner''s own account\n';

  -- the boolean is public; the account id is not
  select public.can_receive_payouts(other) into ok;
  if ok then raise exception 'PROBE FAILED: other reported payable while disabled'; end if;
  select public.can_receive_payouts(seller) into ok;
  if not ok then raise exception 'PROBE FAILED: seller not reported payable'; end if;
  results := results || E'2c can_receive_payouts reads across members, id does not\n';

  ------------------------------------------------- 3. Stripe can turn it back off
  perform set_config('role', 'postgres', true);
  perform public.upsert_payout_account(seller, 'acct_probe_seller', true, false, true,
                                       array['individual.verification.document']);
  select public.can_receive_payouts(seller) into ok;
  if ok then raise exception 'PROBE FAILED: payouts still enabled after Stripe disabled them'; end if;
  results := results || E'3a account.updated can REVOKE payability, not just grant it\n';

  perform public.upsert_payout_account(seller, 'acct_probe_seller', true, true, true);

  ------------------------------------------------------------- 4. the gate
  -- 4a: flag OFF (today). The gate must not exist in practice.
  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE gate flag off', 50000, creature, 'available');
  results := results || E'4a flag OFF: animal listing still inserts (no regression today)\n';

  -- 4b: flag ON, seller HAS payouts -> still allowed
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  perform set_config('role', 'authenticated', true);
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE gate payable', 50000, creature, 'available');
  results := results || E'4b flag ON + payouts enabled: allowed\n';

  -- 4c: flag ON, seller has NO working payout account -> refused
  perform set_config('role', 'postgres', true);
  perform public.upsert_payout_account(seller, 'acct_probe_seller', true, false, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.listings (seller_id, title, price_cents, creature_id, availability)
    values (seller, 'PROBE gate unpayable', 50000, creature, 'available');
    raise exception 'PROBE FAILED: animal listed with payments ON and no payout account';
  exception when insufficient_privilege then
    results := results || E'4c flag ON + payouts disabled: REFUSED by RLS\n';
  end;

  -- 4d: a non-animal listing is unaffected either way
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE service listing', 5000, 'available');
  results := results || E'4d non-animal listing unaffected by the payout gate\n';

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';

  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
