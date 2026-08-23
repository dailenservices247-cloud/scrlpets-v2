-- Free means everything. This probe exists to keep it that way.
--
-- It used to assert the opposite: that brand pages and merchandise were REFUSED
-- to a free member once subscriptions_enabled went true. Those two restrictive
-- policies were dropped in 20260823165414 because the pricing copy a member
-- actually reads — subscription_tiers.description, the only thing TierList
-- renders — says free is "Everything on Scrlpets" and Pro is "A 2.5% fee
-- instead of 5%". Pro is the fee cut and the pause; it is not a feature tier.
--
-- The assertions below are the inverse of the old ones ON PURPOSE. 2a and 2b
-- are the load-bearing pair: they turn subscriptions ON and prove a free member
-- STILL gets everything, which is exactly what a re-added gate would break.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  member  uuid := '00000000-0000-0000-0000-000000000011';
  n       integer;
  results text := '';
  stamp   text := floor(extract(epoch from clock_timestamp()))::text;
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='subscriptions_enabled';
  delete from public.subscriptions where profile_id = member;

  ---------------------------------------- 1. free member, subscriptions OFF
  perform set_config('request.jwt.claims',
    json_build_object('sub',member,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  insert into public.brands (owner_id, name, slug, brand_type)
  values (member, 'PROBE brand off', 'probe-brand-off-' || stamp, 'kennel');
  results := results || E'1a subscriptions OFF: a free member can create a brand\n';

  insert into public.listings (seller_id, title, price_cents, availability)
  values (member, 'PROBE merch off', 5000, 'available');
  results := results || E'1b subscriptions OFF: a free member can list merchandise\n';

  ------------- 2. AND STILL CAN WITH SUBSCRIPTIONS ON — the whole point
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='subscriptions_enabled';
  perform set_config('request.jwt.claims',
    json_build_object('sub',member,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    insert into public.brands (owner_id, name, slug, brand_type)
    values (member, 'PROBE brand on', 'probe-brand-on-' || stamp, 'kennel');
  exception when insufficient_privilege then
    raise exception 'PROBE FAILED: a free member was REFUSED a brand page with subscriptions live — a paid gate is back, and free no longer means "Everything on Scrlpets"';
  end;
  results := results || E'2a subscriptions ON: a free member STILL creates a brand — no gate returned\n';

  begin
    insert into public.listings (seller_id, title, price_cents, availability)
    values (member, 'PROBE merch on', 5000, 'available');
  exception when insufficient_privilege then
    raise exception 'PROBE FAILED: a free member was REFUSED merchandise with subscriptions live — a paid gate is back';
  end;
  results := results || E'2b subscriptions ON: a free member STILL lists merchandise\n';

  ------------------------- 3. what Pro actually buys, and it is not features
  perform set_config('role','postgres',true);
  if public.seller_fee_bps_for(member) <> 500 then
    raise exception 'PROBE FAILED: a free member is not on the 5%% rate';
  end if;
  insert into public.subscriptions (profile_id, tier_key, status, created_at)
  values (member, 'pro_12mo', 'active', now() - interval '60 days');
  if public.seller_fee_bps_for(member) <> 250 then
    raise exception 'PROBE FAILED: Pro is not on 2.5%% — the fee cut IS the product';
  end if;
  results := results || E'3a Pro buys the fee cut: 5% -> 2.5%, and that is what it buys\n';

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='subscriptions_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
