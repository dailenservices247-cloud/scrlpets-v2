-- Module 1 probe: public establishment team, profile brand memberships,
-- creature origin attribution, creature-linked direct messaging, and alumni
-- lineage continuity.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  owner_id   uuid := '00000000-0000-0000-0000-000000000001';
  co_admin   uuid;
  brand      uuid;
  sire_id    uuid;
  pup_id     uuid;
  app_id     uuid;
  inq_rec    record;
  origin_rec record;
  n          integer;
  results    text := '';
begin
  perform set_config('role', 'postgres', true);
  select id into co_admin from public.profiles where id <> owner_id limit 1;

  insert into public.brands (name, brand_type, owner_id, slug)
  values ('PROBE Discovery Kennel', 'kennel', owner_id, 'probe-disc-' || substr(md5(random()::text),1,8))
  returning id into brand;

  insert into public.brand_memberships (brand_id, profile_id, role)
  values (brand, owner_id, 'owner'),
         (brand, co_admin, 'admin')
  on conflict (brand_id, profile_id) do nothing;

  insert into public.creatures (owner_id, name, species, slug, in_roster)
  values (owner_id, 'PROBE Sire', 'dog', 'probe-sire-' || substr(md5(random()::text),1,8), true)
  returning id into sire_id;

  insert into public.creatures (owner_id, name, species, slug, in_roster)
  values (owner_id, 'PROBE Pup', 'dog', 'probe-pup-' || substr(md5(random()::text),1,8), true)
  returning id into pup_id;

  insert into public.creature_lineage (creature_id, parent_id, parent_type)
  values (pup_id, sire_id, 'sire');

  --------------------------------------- 1. anon can read the establishment team
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.public_brand_team(brand);
  if n <> 2 then
    raise exception 'PROBE FAILED: expected 2 team members on public_brand_team, got %', n;
  end if;
  results := results || E'1a anon can see all people running an active establishment\n';

  ------------------------ 2. profile_public_brands includes admin memberships
  select count(*) into n
    from public.profile_public_brands(co_admin)
   where id = brand and role = 'admin';
  if n <> 1 then
    raise exception 'PROBE FAILED: co-admin establishment missing from profile_public_brands';
  end if;
  results := results || E'2a profile_public_brands surfaces co-operated establishments with role\n';

  --------------------- 3. creature_origin_attribution resolves establishment
  select * into origin_rec from public.creature_origin_attribution(pup_id);
  if origin_rec.breeder_id <> owner_id or origin_rec.brand_id is null then
    raise exception 'PROBE FAILED: creature_origin_attribution failed to resolve breeder/brand';
  end if;
  results := results || E'3a creature_origin_attribution resolves breeder and establishment\n';

  ------------------- 4. start_creature_inquiry attaches the animal to a thread
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', co_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select * into inq_rec from public.start_creature_inquiry(pup_id);
  if inq_rec.conversation_id is null or not inq_rec.created then
    raise exception 'PROBE FAILED: start_creature_inquiry did not create inquiry context';
  end if;

  select count(*) into n
    from public.listing_inquiries
   where id = inq_rec.inquiry_id
     and creature_id_snapshot = pup_id;
  if n <> 1 then
    raise exception 'PROBE FAILED: inquiry row missing creature_id_snapshot';
  end if;
  results := results || E'4a start_creature_inquiry opens an active thread with the animal attached\n';

  --------- 5. alumni handover keeps the offspring on the breeder's lineage tree
  perform set_config('role', 'postgres', true);
  insert into public.buyer_applications (buyer_id, seller_id, message, status, buyer_confirmed_at, seller_confirmed_at)
  values (co_admin, owner_id, 'PROBE application', 'accepted', now(), now())
  returning id into app_id;

  insert into public.alumni (creature_id, breeder_id, owner_id, application_id, handover_at)
  values (pup_id, owner_id, co_admin, app_id, now());

  update public.creatures set owner_id = co_admin where id = pup_id;

  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role', 'anon', true);

  select count(*) into n
    from public.owner_lineage_edges(owner_id)
   where creature_id = pup_id and parent_id = sire_id;
  if n <> 1 then
    raise exception 'PROBE FAILED: alumni offspring disappeared from breeder owner_lineage_edges';
  end if;

  select count(*) into n
    from public.tree_extended_creatures(owner_id, true)
   where id = pup_id;
  if n <> 1 then
    raise exception 'PROBE FAILED: alumni offspring missing from breeder tree_extended_creatures';
  end if;

  select count(*) into n
    from public.tree_extended_creatures(co_admin, true)
   where id = sire_id;
  if n <> 1 then
    raise exception 'PROBE FAILED: sire missing from buyer tree_extended_creatures';
  end if;

  select * into origin_rec from public.creature_origin_attribution(pup_id);
  if not origin_rec.is_alumni or origin_rec.breeder_id <> owner_id then
    raise exception 'PROBE FAILED: creature_origin_attribution did not preserve alumni breeder after transfer';
  end if;
  results := results || E'5a alumni handover preserves breeder attribution, tree offspring, and buyer parent lineage\n';

  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
