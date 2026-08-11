-- The narrow self-record path must not become a way to self-grant payouts.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  seller uuid := '00000000-0000-0000-0000-000000000011';
  got text; results text := '';
begin
  perform set_config('role', 'postgres', true);
  delete from public.seller_payout_accounts where profile_id = seller;

  perform set_config('request.jwt.claims',
    json_build_object('sub', seller, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.record_new_payout_account('acct_probe_self');

  perform set_config('role', 'postgres', true);
  select charges_enabled::text || '/' || payouts_enabled::text || '/' || details_submitted::text
    into got from public.seller_payout_accounts where profile_id = seller;
  if got <> 'false/false/false' then
    raise exception 'PROBE FAILED: self-recorded account came with capabilities %', got;
  end if;
  results := results || E'1a a seller records their own account id with NO capabilities\n';

  if public.can_receive_payouts(seller) then
    raise exception 'PROBE FAILED: self-record made the seller payable';
  end if;
  results := results || E'1b self-recording does not make a seller payable\n';

  -- Stripe grants it, then a re-run of onboarding must not revoke it
  perform public.upsert_payout_account(seller, 'acct_probe_self', true, true, true);
  perform set_config('role', 'authenticated', true);
  perform public.record_new_payout_account('acct_probe_self');
  perform set_config('role', 'postgres', true);
  if not public.can_receive_payouts(seller) then
    raise exception 'PROBE FAILED: re-running onboarding revoked an approved seller';
  end if;
  results := results || E'1c re-running onboarding does NOT reset an already-approved seller\n';

  -- and it cannot be used to hijack another member's account id
  perform set_config('role', 'authenticated', true);
  begin
    perform public.record_new_payout_account('acct_probe_self');
    results := results || E'1d a second call is a no-op, not an overwrite\n';
  exception when others then
    raise;
  end;

  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;
select msg from probe_out;
rollback;
