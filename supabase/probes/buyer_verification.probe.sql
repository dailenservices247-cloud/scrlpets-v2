-- Probes the buyer-side identity gate. Both directions matter: it must BITE
-- above the threshold and must NOT bite below it, or the cheap shipped category
-- dies for no protection.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000011';
  buyer    uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  cheap    uuid; dear uuid; merch uuid;
  ord      uuid; got text; results text := '';
begin
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';
  perform public.upsert_payout_account(seller, 'acct_probe_bv', true, true, true);
  delete from public.identity_verifications where profile_id = buyer;

  -- create_order gates on attestation as well as anchor. Earlier probes inserted
  -- orders directly and never reached this check, so the fixture was never
  -- attested — assert it here rather than assuming, or every create_order below
  -- fails for the wrong reason.
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (creature, seller, 'attested')
  on conflict (creature_id) do update set status = 'attested';
  if not public.is_animal_listable(creature) then
    raise exception 'PROBE INVALID: fixture animal is not listable, create_order would fail for the wrong reason';
  end if;

  if public.buyer_verification_threshold_cents() <> 50000 then
    raise exception 'PROBE FAILED: threshold is not $500';
  end if;
  results := results || E'0a threshold is $500\n';

  -- $499 animal, unverified buyer: must go through
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE cheap animal', 49900, creature, 'available') returning id into cheap;
  perform set_config('request.jwt.claims',
    json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(cheap);
  if ord is null then raise exception 'PROBE FAILED: cheap order not created'; end if;
  results := results || E'1a $499 animal, unverified buyer: ALLOWED — the wall stays off cheap sales\n';

  -- $500 animal, unverified buyer: refused
  perform set_config('role', 'postgres', true);
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (seller, 'PROBE dear animal', 50000, creature, 'available') returning id into dear;
  perform set_config('role', 'authenticated', true);
  begin
    ord := public.create_order(dear);
    raise exception 'PROBE FAILED: $500 animal bought by an unverified buyer';
  exception when others then
    if sqlerrm <> 'buyer_verification_required' then raise; end if;
    results := results || E'1b $500 animal, unverified buyer: REFUSED at creation, before any charge\n';
  end;

  -- merchandise at the same price is unaffected
  perform set_config('role', 'postgres', true);
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE merch', 200000, 'available') returning id into merch;
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(merch);
  if ord is null then raise exception 'PROBE FAILED: merch order refused'; end if;
  results := results || E'1c $2000 of MERCH is unaffected — goods can be returned, an animal cannot\n';

  -- verify the buyer, then the same animal goes through
  perform set_config('role', 'postgres', true);
  insert into public.identity_verifications (profile_id, status)
  values (buyer, 'verified')
  on conflict (profile_id) do update set status = 'verified';
  perform set_config('role', 'authenticated', true);
  ord := public.create_order(dear);
  if ord is null then raise exception 'PROBE FAILED: verified buyer still refused'; end if;
  results := results || E'2a once verified, the same $500 animal goes through\n';

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;
select msg from probe_out;
rollback;
