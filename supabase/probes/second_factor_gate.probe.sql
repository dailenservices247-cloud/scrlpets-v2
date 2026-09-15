-- The second-factor database gate, rolled back.
-- 1, 2 and 6 are the outage checks: a gate that refuses signed-out visitors,
-- members without two-factor or server jobs takes down the whole Data API.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  member   uuid := '00000000-0000-0000-0000-000000000001';
  results  text := '';
  cfg      text[];
  n        integer;
  refused  boolean;
begin
  perform set_config('role', 'postgres', true);
  delete from auth.mfa_factors where user_id = member;

  ------------------------------------- 0. registered as the pre-request hook
  select rolconfig into cfg from pg_roles where rolname = 'authenticator';
  if cfg is null or not ('pgrst.db_pre_request=public.enforce_second_factor' = any(cfg)) then
    raise exception 'PROBE FAILED: enforce_second_factor is not the PostgREST pre-request hook';
  end if;
  results := results || E'0a enforce_second_factor is the PostgREST pre-request hook\n';

  ------------------------------------------------ 1. signed-out requests pass
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.path', '/guides', true);
  perform set_config('role', 'anon', true);
  perform public.enforce_second_factor();
  results := results || E'1a a signed-out request passes\n';

  ------------------------------------ 2. a member without two-factor passes
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.enforce_second_factor();
  results := results || E'2a a member without two-factor passes at aal1\n';

  ----------------- 3. the same member with a verified factor is refused at aal1
  perform set_config('role', 'postgres', true);
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), member, 'probe', 'totp', 'verified', now(), now(), 'probe-secret');
  perform set_config('role', 'authenticated', true);
  refused := false;
  begin
    perform public.enforce_second_factor();
  exception when others then
    if sqlstate <> 'PT403' or sqlerrm <> 'second_factor_required' then raise; end if;
    refused := true;
  end;
  if not refused then
    raise exception 'PROBE FAILED: an aal1 session with a verified factor passed the gate';
  end if;
  results := results || E'3a an aal1 session with a verified factor is refused (PT403)\n';

  -------------------------------------------- 4. the ways back in stay open
  perform set_config('request.path', '/rpc/consume_mfa_recovery_code', true);
  perform public.enforce_second_factor();
  perform set_config('request.path', '/rpc/clear_login_failures', true);
  perform public.enforce_second_factor();
  results := results || E'4a recovery-code and lockout-reset RPCs stay open while the code is owed\n';

  ------------------------------------------------- 5. aal2 passes everywhere
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.path', '/saved_searches', true);
  perform set_config('role', 'authenticated', true);
  perform public.enforce_second_factor();
  results := results || E'5a an aal2 session passes\n';

  -------------------------------------------- 6. server-side jobs pass
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
  perform public.enforce_second_factor();
  results := results || E'6a a service-role request passes\n';

  ------------- 7. Realtime and Storage carry the same condition, restrictively
  perform set_config('role', 'postgres', true);
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'messages' and cmd = 'SELECT'
     and permissive = 'RESTRICTIVE' and qual like '%session_owes_second_factor%';
  if n <> 1 then
    raise exception 'PROBE FAILED: messages has no restrictive second-factor read policy';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
     and permissive = 'RESTRICTIVE' and with_check like '%session_owes_second_factor%';
  if n <> 1 then
    raise exception 'PROBE FAILED: storage.objects has no restrictive second-factor upload policy';
  end if;
  results := results || E'7a message reads and uploads are restricted by the same condition\n';

  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
