-- The paywall must be INERT today and BITE when subscriptions turn on. Either
-- half failing is a shipped bug: inert-forever is a decorative paywall, and
-- biting today removes capabilities from every existing member.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  member uuid := '00000000-0000-0000-0000-000000000011';
  creature uuid := '68cd1574-966d-43f7-a212-0d5fa0ec1f9c';
  n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='subscriptions_enabled';
  delete from public.subscriptions where profile_id = member;

  ------------------------------------------- 1. inert while subscriptions are off
  perform set_config('request.jwt.claims',
    json_build_object('sub',member,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  insert into public.brands (owner_id, name, slug, brand_type)
  values (member, 'PROBE brand off', 'probe-brand-off-' || floor(extract(epoch from clock_timestamp()))::text, 'kennel');
  results := results || E'1a subscriptions OFF: a member can still create a brand — nothing is taken away\n';

  insert into public.listings (seller_id, title, price_cents, availability)
  values (member, 'PROBE merch off', 5000, 'available');
  results := results || E'1b subscriptions OFF: a member can still list merchandise\n';

  ------------------------------------------- 2. bites once subscriptions are on
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='subscriptions_enabled';
  perform set_config('role','authenticated',true);

  begin
    insert into public.brands (owner_id, name, slug, brand_type)
    values (member, 'PROBE brand on', 'probe-brand-on-x', 'kennel');
    raise exception 'PROBE FAILED: a free member created a brand page with subscriptions live';
  exception when insufficient_privilege then
    results := results || E'2a subscriptions ON, free member: brand page REFUSED\n';
  end;

  begin
    insert into public.listings (seller_id, title, price_cents, availability)
    values (member, 'PROBE merch on', 5000, 'available');
    raise exception 'PROBE FAILED: a free member listed merchandise with subscriptions live';
  exception when insufficient_privilege then
    results := results || E'2b subscriptions ON, free member: merch listing REFUSED\n';
  end;

  ------------------------------------------- 3. animals are NEVER gated
  perform set_config('role','postgres',true);
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (creature, member, 'attested') on conflict (creature_id) do update set status='attested';
  perform set_config('role','authenticated',true);
  insert into public.listings (seller_id, title, price_cents, creature_id, availability)
  values (member, 'PROBE animal on', 200000, creature, 'available');
  results := results || E'3a an ANIMAL listing is never gated — the platform earns a fee on it already\n';

  ------------------------------------------- 4. Pro passes
  perform set_config('role','postgres',true);
  insert into public.subscriptions (profile_id, tier_key, status)
  values (member, 'pro', 'active');
  perform set_config('role','authenticated',true);
  insert into public.brands (owner_id, name, slug, brand_type) values (member, 'PROBE brand pro', 'probe-brand-pro-x', 'kennel');
  insert into public.listings (seller_id, title, price_cents, availability)
  values (member, 'PROBE merch pro', 5000, 'available');
  results := results || E'4a a Pro member passes both gates\n';

  ------------------------------------------- 5. a PAUSED subscription does not
  perform set_config('role','postgres',true);
  update public.subscriptions set paused_at = now() where profile_id = member;
  perform set_config('role','authenticated',true);
  begin
    insert into public.brands (owner_id, name, slug, brand_type) values (member, 'PROBE brand paused', 'probe-brand-paused-x', 'kennel');
    raise exception 'PROBE FAILED: a PAUSED subscription still unlocked the brand page';
  exception when insufficient_privilege then
    results := results || E'5a paused: the gate closes again — that is what gives pausing teeth\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='subscriptions_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
