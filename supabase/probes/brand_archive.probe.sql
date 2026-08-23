-- Brands can finally be removed from view, and 6 is the reason it is an ARCHIVE.
-- A hard delete would orphan every post, listing and membership pointing at the
-- brand, plus the append-only brand_content_events audit spine.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  owner_id   uuid := '00000000-0000-0000-0000-000000000001';
  stranger   uuid;
  brand      uuid;
  post_id    uuid;
  n          integer;
  results    text := '';
begin
  perform set_config('role', 'postgres', true);
  select id into stranger from public.profiles where id <> owner_id limit 1;

  insert into public.brands (name, brand_type, owner_id, slug)
  values ('PROBE archive brand', 'kennel',  owner_id, 'probe-archive-' || substr(md5(random()::text),1,8))
  returning id into brand;

  insert into public.posts (author_id, body, posting_as_type, brand_id)
  values (owner_id, 'PROBE brand-attributed post', 'brand', brand)
  returning id into post_id;

  ------------------------------------------- 1. a stranger cannot archive it
  perform set_config('request.jwt.claims',
    json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.archive_brand(brand, true);
    raise exception 'PROBE FAILED: a non-owner archived someone else''s brand';
  exception when others then
    if sqlerrm not like '%not_the_owner%' then raise; end if;
  end;
  results := results || E'1a a non-owner cannot archive a brand\n';

  ------------------------------------------------- 2. the owner can archive it
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.archive_brand(brand, true);
  results := results || E'2a the owner can archive their own brand\n';

  ------------------------------------- 3. an archived brand is gone for anon
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.brands where id = brand;
  if n <> 0 then raise exception 'PROBE FAILED: anon can still read an archived brand'; end if;
  results := results || E'3a an archived brand is invisible to anon\n';

  ------------------------- 4. the owner still sees it, or unarchive is unreachable
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.brands where id = brand;
  if n <> 1 then raise exception 'PROBE FAILED: the owner cannot see their own archived brand'; end if;
  results := results || E'4a the owner still sees their archived brand\n';

  ------------------------------------------------ 5. unarchiving restores it
  perform public.archive_brand(brand, false);
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.brands where id = brand;
  if n <> 1 then raise exception 'PROBE FAILED: unarchiving did not restore public visibility'; end if;
  results := results || E'5a unarchiving restores public visibility\n';

  -------------------------- 6. the content survives — this is why it is an archive
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.archive_brand(brand, true);
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.posts where id = post_id and brand_id = brand;
  if n <> 1 then raise exception 'PROBE FAILED: archiving a brand destroyed its attributed content'; end if;
  results := results || E'6a archiving hides an identity and destroys no evidence\n';

  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
