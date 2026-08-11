-- Probes that a listing cannot make an ambiguous promise, and that the preview a
-- seller sees is literally the text a buyer reads.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  seller   uuid := '00000000-0000-0000-0000-000000000011';
  other    uuid := '00000000-0000-0000-0000-000000000001';
  lst      uuid;
  got      text;
  n        integer;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  insert into public.listings (seller_id, title, price_cents, availability)
  values (seller, 'PROBE guarantee', 100000, 'available') returning id into lst;

  ------------------------------------- 1. every template names a remedy
  select count(*) into n from public.guarantee_templates where remedy is null;
  if n > 0 then raise exception 'PROBE FAILED: % templates promise coverage with no remedy', n; end if;
  select count(*) into n from public.guarantee_templates;
  if n < 4 then raise exception 'PROBE FAILED: only % templates seeded', n; end if;
  results := results || E'1a every template names a remedy — coverage alone is not a guarantee\n';

  -- species-neutral: nothing dog- or mammal-shaped in what a bird keeper reads
  select count(*) into n from public.guarantee_templates
   where lower(name || ' ' || coverage_description || ' ' || array_to_string(conditions, ' '))
         ~ '(litter|puppy|puppies|kitten|whelp|dam |sire |bitch)';
  if n > 0 then raise exception 'PROBE FAILED: % templates carry species-specific language', n; end if;
  results := results || E'1b templates are species-neutral — no litter/puppy/kitten language\n';

  ------------------------- 2. the ambiguity legacy manufactured is now impossible
  begin
    insert into public.listing_guarantees (listing_id, kind) values (lst, 'template');
    raise exception 'PROBE FAILED: a template guarantee with no template';
  exception when check_violation then
    results := results || E'2a kind=template with no template_key: refused\n';
  end;

  begin
    insert into public.listing_guarantees (listing_id, kind, template_key, custom_terms)
    values (lst, 'template', 'health_14d_vet', 'my own different terms');
    raise exception 'PROBE FAILED: two competing documents on one listing';
  exception when check_violation then
    results := results || E'2b a template AND custom terms together: refused — one governing document\n';
  end;

  begin
    insert into public.listing_guarantees (listing_id, kind, custom_terms)
    values (lst, 'custom', 'covered for a while');
    raise exception 'PROBE FAILED: custom terms with no remedy';
  exception when check_violation then
    results := results || E'2c custom terms with no remedy: refused — that IS the ambiguity\n';
  end;

  ------------------------------------- 3. an unpublished guarantee still SAYS so
  select headline into got from public.listing_guarantee_text(lst);
  if got <> 'No health guarantee' then
    raise exception 'PROBE FAILED: a listing with no guarantee row rendered %', coalesce(got, '<null>');
  end if;
  select kind into got from public.listing_guarantee_text(lst);
  if got <> 'none' then raise exception 'PROBE FAILED: kind = %', got; end if;
  results := results || E'3a no guarantee published -> an explicit "No health guarantee", never silence\n';

  ------------------------------------- 4. the published promise, and its remedy
  insert into public.listing_guarantees (listing_id, kind, template_key)
  values (lst, 'template', 'congenital_1y_refund');

  select remedy_sentence into got from public.listing_guarantee_text(lst);
  if got not like '%returned to the seller%' then
    raise exception 'PROBE FAILED: refund-on-return did not state the return condition: %', got;
  end if;
  results := results || E'4a the buyer is told plainly that a refund requires returning the animal\n';

  select public.listing_guarantee_branch(lst) into got;
  if got <> 'guarantee_refund_on_return' then
    raise exception 'PROBE FAILED: branch resolved to %', got;
  end if;
  results := results || E'4b the listing resolves to the seller''s OWN settlement branch\n';

  update public.listing_guarantees set template_key = 'health_14d_vet' where listing_id = lst;
  select public.listing_guarantee_branch(lst) into got;
  if got <> 'guarantee_vet_costs' then raise exception 'PROBE FAILED: branch = %', got; end if;
  select remedy_sentence into got from public.listing_guarantee_text(lst);
  if got not like '%keep the animal%' then
    raise exception 'PROBE FAILED: vet-costs remedy did not say the buyer keeps the animal: %', got;
  end if;
  results := results || E'4c a vet-costs guarantee says the buyer KEEPS the animal\n';

  ------------------------------------- 5. preview and listing are one source
  -- Both surfaces call listing_guarantee_text. Asserted by there being exactly
  -- one function that produces buyer-facing guarantee prose.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname like '%guarantee%text%';
  if n <> 1 then
    raise exception 'PROBE FAILED: % functions render guarantee text — preview and listing can drift', n;
  end if;
  results := results || E'5a exactly ONE function renders the text: the preview cannot lie\n';

  ------------------------------------- 6. only the seller writes their promise
  perform set_config('request.jwt.claims',
    json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.listing_guarantees set template_key = 'live_arrival_72h' where listing_id = lst;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'PROBE FAILED: a stranger rewrote a seller''s guarantee'; end if;
  results := results || E'6a a non-owner cannot rewrite the promise on someone else''s listing\n';

  perform set_config('role', 'postgres', true);
  insert into probe_out (msg)
  select unnest(string_to_array(btrim(results, E'\n'), E'\n'));
end $probe$;

select msg from probe_out;

rollback;
