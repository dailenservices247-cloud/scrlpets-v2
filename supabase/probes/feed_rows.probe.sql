-- The feed's filters, now that they live in SQL instead of in a URL.
--
-- 5 is the one that matters most: feed_rows is SECURITY INVOKER, and a DEFINER
-- would return every row to everyone while every other assertion here still
-- passed — they check that rows are PRESENT. Only the blocked-author and
-- unfollowed-author cases can catch that mistake.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  viewer     uuid := '00000000-0000-0000-0000-000000000001';
  followed   uuid;
  unfollowed uuid;
  blocker    uuid;
  own_post   uuid;
  fol_post   uuid;
  unf_post   uuid;
  blk_post   uuid;
  fix_post   uuid;
  null_post  uuid;
  n          integer;
  results    text := '';
begin
  perform set_config('role', 'postgres', true);

  select id into followed   from public.profiles where id <> viewer limit 1;
  select id into unfollowed from public.profiles where id not in (viewer, followed) limit 1;
  select id into blocker    from public.profiles where id not in (viewer, followed, unfollowed) limit 1;

  -- A clean graph for this viewer, rolled back with everything else.
  delete from public.follows where follower_id = viewer;
  delete from public.blocks  where blocker_id = viewer or blocked_id = viewer;
  insert into public.follows (follower_id, following_id) values (viewer, followed);
  -- Blocked in the direction the viewer did NOT initiate: blocked_profile_ids()
  -- covers both, and only that makes "they blocked you" actually hide anything.
  insert into public.blocks (blocker_id, blocked_id) values (blocker, viewer);

  insert into public.posts (author_id, body) values (viewer,     'PROBE own post')        returning id into own_post;
  insert into public.posts (author_id, body) values (followed,   'PROBE followed post')   returning id into fol_post;
  insert into public.posts (author_id, body) values (unfollowed, 'PROBE unfollowed post') returning id into unf_post;
  insert into public.posts (author_id, body) values (blocker,    'PROBE blocker post')    returning id into blk_post;
  insert into public.posts (author_id, body) values (followed,   'E2E fixture post')      returning id into fix_post;
  insert into public.posts (author_id, body) values (followed,   null)                    returning id into null_post;

  perform set_config('request.jwt.claims',
    json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  ------------------------------------------------ 1. the open feed returns rows
  select count(*) into n from public.feed_rows(false, false, 500);
  if n = 0 then raise exception 'PROBE FAILED: feed_rows returned nothing at all'; end if;
  results := results || E'1a feed_rows returns rows for a signed-in viewer\n';

  ------------------------------------------- 2. following: a followed author IS in
  select count(*) into n from public.feed_rows(true, false, 500) f where f.id = fol_post;
  if n <> 1 then raise exception 'PROBE FAILED: following feed missing a followed author''s post'; end if;
  results := results || E'2a following: a followed author''s post is present\n';

  --------------------------------- 3. following: an unfollowed author is NOT in
  select count(*) into n from public.feed_rows(true, false, 500) f where f.id = unf_post;
  if n <> 0 then raise exception 'PROBE FAILED: following feed leaked an unfollowed author'; end if;
  results := results || E'3a following: an unfollowed author is excluded\n';

  ------------------------------------------- 4. following still includes YOUR own
  select count(*) into n from public.feed_rows(true, false, 500) f where f.id = own_post;
  if n <> 1 then raise exception 'PROBE FAILED: following feed dropped the viewer''s own post'; end if;
  results := results || E'4a following: the viewer''s own post survives\n';

  ------------------------------- 5. blocked either direction, on BOTH tabs
  select count(*) into n from public.feed_rows(false, false, 500) f where f.id = blk_post;
  if n <> 0 then raise exception 'PROBE FAILED: for-you leaked a post by someone who blocked the viewer'; end if;
  select count(*) into n from public.feed_rows(true, false, 500) f where f.id = blk_post;
  if n <> 0 then raise exception 'PROBE FAILED: following leaked a post by someone who blocked the viewer'; end if;
  results := results || E'5a a profile that blocked the viewer is hidden on BOTH tabs\n';

  ------------------------- 6. hide_fixtures drops E2E but KEEPS a null title
  select count(*) into n from public.feed_rows(false, true, 500) f where f.id = fix_post;
  if n <> 0 then raise exception 'PROBE FAILED: hide_fixtures kept an E2E row'; end if;
  select count(*) into n from public.feed_rows(false, true, 500) f where f.id = null_post;
  if n <> 1 then raise exception 'PROBE FAILED: hide_fixtures dropped a caption-less post — NULL-eliminating filter'; end if;
  results := results || E'6a hide_fixtures drops E2E rows and KEEPS null-titled ones\n';

  ------------------------------------------------------------ 7. max_rows caps
  select count(*) into n from public.feed_rows(false, false, 2);
  if n > 2 then raise exception 'PROBE FAILED: max_rows did not cap the result (got %)', n; end if;
  results := results || E'7a max_rows caps the result\n';

  perform set_config('role','postgres',true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
