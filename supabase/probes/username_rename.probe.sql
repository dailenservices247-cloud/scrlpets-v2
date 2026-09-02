-- Probes the self-serve rename, rolled back.
--
-- 20260801171418 WITHHELD `username` from the self-writable allowlist for two
-- stated reasons: a rename is an impersonation vector (release the handle and
-- someone poses as you) and a link-rot one (/u/<handle> stops resolving).
-- Renaming is now allowed, so BOTH objections must be answered by mechanism,
-- not by intention. 4 and 5 are the load-bearing ones.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  alice   uuid := '00000000-0000-0000-0000-000000000001';
  mallory uuid := '00000000-0000-0000-0000-000000000011';
  n       integer;
begin
  perform set_config('role', 'postgres', true);
  update public.profiles set username = 'alice_orig', username_changed_at = null where id = alice;
  update public.profiles set username = 'mallory_orig', username_changed_at = null where id = mallory;
  delete from public.username_history where profile_id in (alice, mallory);

  ------------------------------------------------------------ 1. a rename works
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.set_username('alice');
  perform set_config('role', 'postgres', true);
  if (select username from public.profiles where id = alice) <> 'alice' then
    raise exception 'PROBE FAILED: rename did not take';
  end if;
  insert into probe_out (msg) values ('1 rename applied');

  --------------------------------------------- 2. the old handle is RETAINED
  select count(*) into n from public.username_history
   where username = 'alice_orig' and profile_id = alice;
  if n <> 1 then raise exception 'PROBE FAILED: old handle was not reserved'; end if;
  insert into probe_out (msg) values ('2 old handle reserved to its owner');

  ------------------------------------- 3. format and reserved words refused
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.set_username('admin');
    raise exception 'PROBE FAILED: reserved name accepted';
  exception when others then
    if sqlerrm like 'PROBE FAILED%' then raise; end if;
  end;
  begin
    perform public.set_username('has space');
    raise exception 'PROBE FAILED: malformed name accepted';
  exception when others then
    if sqlerrm like 'PROBE FAILED%' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) values ('3 reserved and malformed names refused');

  ------- 4. IMPERSONATION: nobody else may claim a handle alice has released
  update public.profiles set username_changed_at = null where id = mallory;
  perform set_config('request.jwt.claim.sub', mallory::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.set_username('alice_orig');
    raise exception 'PROBE FAILED: a released handle was claimable by another account';
  exception when others then
    if sqlerrm like 'PROBE FAILED%' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) values ('4 released handle NOT claimable by anyone else');

  ------------------- 5. the owner MAY reclaim their own retired handle
  update public.profiles set username_changed_at = null where id = alice;
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.set_username('alice_orig');
  perform set_config('role', 'postgres', true);
  if (select username from public.profiles where id = alice) <> 'alice_orig' then
    raise exception 'PROBE FAILED: owner could not reclaim their own handle';
  end if;
  insert into probe_out (msg) values ('5 owner CAN reclaim their own retired handle');

  --------------------------- 6. rate limit stops handle-burning as griefing
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.set_username('alice_again');
    raise exception 'PROBE FAILED: a second rename inside the window was allowed';
  exception when others then
    if sqlerrm like 'PROBE FAILED%' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) values ('6 second rename inside the cooldown refused');

  ------------------------------------- 7. taking a LIVE handle is refused
  update public.profiles set username_changed_at = null where id = mallory;
  perform set_config('request.jwt.claim.sub', mallory::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.set_username('alice_orig');
    raise exception 'PROBE FAILED: a live handle was claimable';
  exception when others then
    if sqlerrm like 'PROBE FAILED%' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) values ('7 live handle not claimable');

end $probe$;

select msg from probe_out;
rollback;
