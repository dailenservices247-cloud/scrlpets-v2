-- Recovery codes, rolled back.
-- 4 is the one that matters: a code must work exactly ONCE, ever. A recovery
-- code that can be replayed is a password that never expires, written on paper.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  member   uuid := '00000000-0000-0000-0000-000000000001';
  other    uuid;
  codes    text[];
  first    text;
  n        integer;
  ok       boolean;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  select id into other from public.profiles where id <> member limit 1;
  delete from public.mfa_recovery_codes where profile_id in (member, other);

  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  --------------------------------------------------- 1. ten codes, once
  select array_agg(code) into codes from public.generate_mfa_recovery_codes();
  if array_length(codes, 1) <> 10 then
    raise exception 'PROBE FAILED: expected 10 codes, got %', array_length(codes, 1);
  end if;
  results := results || E'1a generate returns exactly ten codes\n';

  --------------------------------------- 2. stored HASHED, never in plaintext
  perform set_config('role', 'postgres', true);
  first := codes[1];
  select count(*) into n from public.mfa_recovery_codes
   where profile_id = member and code_hash = first;
  if n <> 0 then
    raise exception 'PROBE FAILED: a recovery code is stored in plaintext';
  end if;
  select count(*) into n from public.mfa_recovery_codes
   where profile_id = member and code_hash like '$2%';
  if n <> 10 then raise exception 'PROBE FAILED: codes are not bcrypt hashes'; end if;
  results := results || E'2a codes are stored as bcrypt hashes, never plaintext\n';

  ------------------------------------------------------ 3. a good code works
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.consume_mfa_recovery_code(first);
  if not ok then raise exception 'PROBE FAILED: a freshly issued code was refused'; end if;
  results := results || E'3a a freshly issued code is accepted\n';

  ------------------------------------------- 4. and works exactly ONCE, ever
  ok := public.consume_mfa_recovery_code(first);
  if ok then
    raise exception 'PROBE FAILED: a recovery code was accepted TWICE — it is a reusable password';
  end if;
  results := results || E'4a a spent code is refused on every later attempt\n';

  ------------------------------------------------- 5. a wrong code is refused
  ok := public.consume_mfa_recovery_code('00000-00000');
  if ok then raise exception 'PROBE FAILED: an unissued code was accepted'; end if;
  results := results || E'5a an unissued code is refused\n';

  ------------------------- 6. one member's code does nothing for another
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.consume_mfa_recovery_code(codes[2]);
  if ok then
    raise exception 'PROBE FAILED: a code issued to one member unlocked another';
  end if;
  results := results || E'6a a code is useless to anyone but the member it was issued to\n';

  ------------------------------------ 7. nobody can READ the codes back
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', member, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mfa_recovery_codes;
    if n > 0 then
      raise exception 'PROBE FAILED: an authenticated member can read recovery code rows';
    end if;
  exception when insufficient_privilege then
    null; -- refused outright, which is stronger than returning zero rows
  end;
  results := results || E'7a recovery code rows are unreadable by any client role\n';

  ------------------------------- 8. regenerating invalidates what came before
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.generate_mfa_recovery_codes();
  ok := public.consume_mfa_recovery_code(codes[3]);
  if ok then
    raise exception 'PROBE FAILED: a code from the previous set still works after regeneration';
  end if;
  if public.mfa_recovery_codes_remaining() <> 10 then
    raise exception 'PROBE FAILED: remaining count is wrong after regeneration';
  end if;
  results := results || E'8a regenerating invalidates every earlier code, and the count resets\n';

  perform set_config('role','postgres',true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
