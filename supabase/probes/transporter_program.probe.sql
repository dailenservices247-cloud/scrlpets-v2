-- Both gates hold, and a route needs BOTH ends covered.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  hauler uuid; buyer uuid := '00000000-0000-0000-0000-000000000001';
  svc uuid; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  select id into hauler from public.profiles where id <> buyer limit 1;
  delete from public.seller_programs where profile_id = hauler and program_type='transporter';
  delete from public.seller_payout_accounts where profile_id = hauler;

  insert into public.services (owner_id, name, category, price_cents, active)
  values (hauler,'PROBE hauling','transport',25000,true) returning id into svc;
  insert into public.transport_coverage (service_id, region_code) values (svc,'OH'),(svc,'MI');

  ------------------------------------------------------ 1. neither gate met
  if public.can_transport(hauler) then
    raise exception 'PROBE FAILED: bookable with no approval and no payout account';
  end if;
  results := results || E'1a unapproved, unpayable: not bookable\n';

  ------------------------------------------- 2. approved but cannot be paid
  -- credential_number is NOT NULL by design: a transporter program carries a
  -- real credential — the APHIS class T registration where the haul legally
  -- needs one, an insurance policy number otherwise.
  insert into public.seller_programs (profile_id, program_type, status,
                                      credential_number, issuing_authority)
  values (hauler,'transporter','approved','APHIS-PROBE-1','USDA APHIS');
  if public.can_transport(hauler) then
    raise exception 'PROBE FAILED: approved transporter bookable with no way to receive money';
  end if;
  results := results || E'2a approved but unpayable: STILL not bookable — two gates, not one\n';

  ------------------------------------------- 3. payable but not approved
  perform public.upsert_payout_account(hauler,'acct_probe_haul',true,true,true);
  update public.seller_programs set status='pending'
   where profile_id=hauler and program_type='transporter';
  if public.can_transport(hauler) then
    raise exception 'PROBE FAILED: a PENDING application was bookable';
  end if;
  results := results || E'3a payable but only pending: not bookable\n';

  update public.seller_programs set status='rejected'
   where profile_id=hauler and program_type='transporter';
  if public.can_transport(hauler) then
    raise exception 'PROBE FAILED: a REJECTED applicant was bookable';
  end if;
  results := results || E'3b rejected: not bookable\n';

  ------------------------------------------- 4. both gates met
  update public.seller_programs set status='approved'
   where profile_id=hauler and program_type='transporter';
  if not public.can_transport(hauler) then
    raise exception 'PROBE FAILED: approved AND payable is still not bookable';
  end if;
  results := results || E'4a approved AND payable: bookable\n';

  ------------------------------------------- 5. a route needs BOTH ends
  select count(*) into n from public.transporters_for_route('OH','MI') where service_id = svc;
  if n <> 1 then raise exception 'PROBE FAILED: covered route returned % rows', n; end if;
  results := results || E'5a a route they cover at both ends is offered\n';

  select count(*) into n from public.transporters_for_route('OH','CA') where service_id = svc;
  if n <> 0 then
    raise exception 'PROBE FAILED: offered for a route they cannot finish (% rows)', n;
  end if;
  results := results || E'5b one end covered is NOT enough — a half-route is a cancelled booking\n';

  select count(*) into n from public.transporters_for_route('oh','mi') where service_id = svc;
  if n <> 1 then raise exception 'PROBE FAILED: lowercase region codes did not match'; end if;
  results := results || E'5c region codes match case-insensitively\n';

  ------------------------------------------- 6. losing payouts un-books them
  perform public.upsert_payout_account(hauler,'acct_probe_haul',true,false,true);
  select count(*) into n from public.transporters_for_route('OH','MI') where service_id = svc;
  if n <> 0 then
    raise exception 'PROBE FAILED: still offered after Stripe revoked payouts';
  end if;
  results := results || E'6a Stripe revoking payouts removes them from checkout immediately\n';

  ------------------------------------------- 7. nobody self-approves
  perform public.upsert_payout_account(hauler,'acct_probe_haul',true,true,true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',hauler,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  update public.seller_programs set status='approved'
   where profile_id=hauler and program_type='transporter';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'PROBE FAILED: a transporter approved themselves'; end if;
  results := results || E'7a a transporter cannot approve their own application\n';

  perform set_config('role','postgres',true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
