-- Probes Modules 2 through 5:
-- Universal merchants/recommendations, standing policies 30-day lock, deal contracts,
-- transport payout policies/quotes/transfer, and verified counterparty dossier.
begin;
create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  buyer  uuid := '00000000-0000-0000-0000-000000000001';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  conv uuid;
  lst uuid;
  rec_id uuid;
  svc uuid;
  cid uuid;
  ord uuid;
  qid uuid;
  dossier jsonb;
  got text;
  results text := '';
begin
  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = true where key = 'payments_enabled';

  -- Setup conversation between buyer and seller
  select id into conv from public.conversations
   where user_a = least(seller, buyer) and user_b = greatest(seller, buyer);
  if conv is null then
    insert into public.conversations (user_a, user_b)
    values (least(seller, buyer), greatest(seller, buyer))
    returning id into conv;
  end if;

  -- Setup seller eligibility
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (creature, seller, 'attested') on conflict (creature_id) do update set status = 'attested';
  insert into public.identity_verifications (profile_id, status) values (buyer, 'verified')
  on conflict (profile_id) do update set status = 'verified';
  perform public.upsert_payout_account(seller, 'acct_ccd_seller', true, true, true);

  -- --------------------------------------------------------------------------
  -- 1. Module 2: Listing seller source, sale mode and product recommendations
  -- --------------------------------------------------------------------------
  insert into public.listings (
    seller_id, title, price_cents, creature_id, availability,
    seller_source, merchant_name, external_sku, sale_mode
  )
  values (
    seller, 'PROBE Animal with Contract', 150000, creature, 'available',
    'distributor', null, null, 'contract_escrow'
  )
  returning id into lst;

  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  rec_id := public.recommend_product(lst, null, null, 'Great healthy pup!');
  if rec_id is null then raise exception 'PROBE FAILED: could not recommend product'; end if;
  results := results || E'1a product recommendation created cleanly\n';

  -- --------------------------------------------------------------------------
  -- 2. Module 3: Seller standing policy and 30-day lock rule
  -- --------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.upsert_seller_standing_policy(
    'refundable_until_inspection', 2000, null, 'Ethical Kennel Standards 2026'
  );
  results := results || E'2a standing policy published with 30-day lock\n';

  -- Attempt to alter deposit policy within 30 days must be refused
  begin
    perform public.upsert_seller_standing_policy(
      'non_refundable_on_buyer_backing_out', 2500, null, 'Stricter No Refund Terms'
    );
    raise exception 'PROBE FAILED: lock was bypassed';
  exception when others then
    if sqlerrm <> 'policy_locked_30_days' then raise; end if;
    results := results || E'2b 30-day lock rule refused tightening standing terms\n';
  end;

  -- --------------------------------------------------------------------------
  -- 3. Module 3: Deal Contract creation, signing and frozen order
  -- --------------------------------------------------------------------------
  cid := public.send_deal_contract(
    conv, lst, 140000, 28000, (current_date + interval '14 days')::date,
    'Includes initial crate and food pack', 'Dailen H.'
  );
  results := results || E'3a seller sent contract offer with frozen terms\n';

  -- Buyer signs contract
  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  ord := public.sign_deal_contract(cid, 'Jane B.');
  if ord is null then raise exception 'PROBE FAILED: signing contract did not return order'; end if;

  select status into got from public.deal_contracts where id = cid;
  if got <> 'signed' then raise exception 'PROBE FAILED: contract status is %', got; end if;

  select amount_cents || '/' || deposit_cents into got from public.orders where id = ord;
  if got <> '140000/28000' then
    raise exception 'PROBE FAILED: order terms mismatch %', got;
  end if;
  results := results || E'3b buyer e-signed contract, generating order with frozen agreed terms\n';

  -- --------------------------------------------------------------------------
  -- 4. Module 4: Carrier Policy, Quotes & Ownership Handover Continuity
  -- --------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  insert into public.services (owner_id, name, category, price_cents, payout_policy, active)
  values (seller, 'PROBE Carrier Service', 'transport', 15000, 'paid_on_show_up', true)
  returning id into svc;

  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  qid := public.request_transport_quote(svc, 'OH', 'MI', (current_date + interval '7 days')::date, 'Need transport', ord, conv);
  if qid is null then raise exception 'PROBE FAILED: could not request quote'; end if;
  results := results || E'4a transport quote requested with route and surcharge\n';

  -- Complete order to released and verify creature ownership transfer
  perform set_config('role', 'postgres', true);
  perform public.record_order_payment(ord, 'deposit', 28000, 'pi_ccd_dep');
  perform public.record_order_payment(ord, 'balance', public.order_due_cents(ord) - 28000, 'pi_ccd_bal');
  update public.orders set status = 'released', handover_at = now() where id = ord;

  select owner_id into got from public.creatures where id = creature;
  if got <> buyer::text then
    raise exception 'PROBE FAILED: creature owner is %, expected buyer %', got, buyer;
  end if;

  if not exists (select 1 from public.alumni where order_id = ord and owner_id = buyer and breeder_id = seller) then
    raise exception 'PROBE FAILED: alumni record was not created for completed order';
  end if;
  results := results || E'4b post-sale creature ownership transferred and alumni recorded\n';

  -- --------------------------------------------------------------------------
  -- 5. Module 5: Seller Compliance Profile & Counterparty Dossier
  -- --------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.upsert_seller_compliance_profile(
    'Black Sheep Kennels LLC', 'OH-LLC-2026-99', 'OH', '123 Main St, Columbus, OH',
    'PetPro Insurance', 'POL-999-SCRL', 'DOT-123456', array['https://example.com/license.pdf']
  );
  results := results || E'5a seller compliance profile saved to vault\n';

  -- Buyer inspects counterparty dossier
  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  dossier := public.order_counterparty_dossier(ord);
  if dossier is null or (dossier->'seller'->>'legal_entity_name') <> 'Black Sheep Kennels LLC' then
    raise exception 'PROBE FAILED: dossier invalid %', dossier;
  end if;
  results := results || E'5b verified counterparty dossier contains seller entity and guarantee audit\n';

  perform set_config('role', 'postgres', true);
  update public.platform_flags set enabled = false where key = 'payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;
select msg from probe_out;
rollback;
