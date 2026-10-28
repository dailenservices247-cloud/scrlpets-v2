-- Migration: Modules 2 to 5 — Universal Merchants, Standing Contracts, Carrier Policies & Verified Counterparty Dossier
-- Modules 2, 3, 4, 5 of Scrlpets v2 completion plan.

-- ============================================================================
-- MODULE 2: Universal Plugged-In Merchants & Curated Recommendations
-- ============================================================================

alter table public.listings
  add column if not exists seller_source text not null default 'distributor'
    check (seller_source in ('merchant', 'distributor')),
  add column if not exists merchant_name text,
  add column if not exists external_sku text,
  add column if not exists external_url text,
  add column if not exists sale_mode text not null default 'direct_checkout'
    check (sale_mode in ('contract_escrow', 'direct_checkout'));

grant select (seller_source, merchant_name, external_sku, external_url, sale_mode)
  on public.listings to anon, authenticated;
grant update (seller_source, merchant_name, external_sku, external_url, sale_mode)
  on public.listings to authenticated;

create table if not exists public.product_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommender_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  creature_id uuid references public.creatures(id) on delete set null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_product_rec_unique
  on public.product_recommendations (recommender_id, listing_id, coalesce(creature_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_product_rec_listing on public.product_recommendations(listing_id);
create index if not exists idx_product_rec_recommender on public.product_recommendations(recommender_id);
create index if not exists idx_product_rec_creature on public.product_recommendations(creature_id);
create index if not exists idx_product_rec_brand on public.product_recommendations(brand_id);

alter table public.product_recommendations enable row level security;

drop policy if exists "anyone reads recommendations" on public.product_recommendations;
create policy "anyone reads recommendations" on public.product_recommendations
  for select to anon, authenticated using (true);

drop policy if exists "recommender creates recommendation" on public.product_recommendations;
create policy "recommender creates recommendation" on public.product_recommendations
  for insert to authenticated with check (recommender_id = auth.uid());

drop policy if exists "recommender deletes recommendation" on public.product_recommendations;
create policy "recommender deletes recommendation" on public.product_recommendations
  for delete to authenticated using (recommender_id = auth.uid());

create or replace function public.recommend_product(
  target_listing uuid,
  target_brand uuid default null,
  target_creature uuid default null,
  rec_note text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  rec_id uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not exists (select 1 from public.listings where id = target_listing and deleted_at is null) then
    raise exception 'listing_not_found';
  end if;
  if target_brand is not null and not exists (
    select 1 from public.brand_memberships where brand_id = target_brand and profile_id = uid
  ) then
    raise exception 'brand_not_managed';
  end if;
  if target_creature is not null and not exists (
    select 1 from public.creatures where id = target_creature and owner_id = uid
  ) then
    raise exception 'creature_not_owned';
  end if;

  insert into public.product_recommendations (recommender_id, brand_id, creature_id, listing_id, note)
  values (uid, target_brand, target_creature, target_listing, nullif(btrim(rec_note), ''))
  on conflict (recommender_id, listing_id, coalesce(creature_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set note = excluded.note, brand_id = coalesce(excluded.brand_id, product_recommendations.brand_id)
  returning id into rec_id;

  return rec_id;
end; $fn$;
revoke execute on function public.recommend_product(uuid, uuid, uuid, text) from anon, public;
grant execute on function public.recommend_product(uuid, uuid, uuid, text) to authenticated;


-- ============================================================================
-- MODULE 3: Standing Policy 30-Day Lock Rule & In-Thread Deal Contracts
-- ============================================================================

create table if not exists public.seller_standing_policies (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  deposit_refundable_policy text not null default 'refundable_until_inspection'
    check (deposit_refundable_policy in ('refundable_until_inspection', 'non_refundable_on_buyer_backing_out', 'custom_disclosed')),
  default_deposit_bps integer not null default 2000
    check (default_deposit_bps >= 0 and default_deposit_bps <= 2500),
  default_guarantee_key text references public.guarantee_templates(key),
  contract_disclosure_terms text not null default 'Standard Scrlpets Ethical Breeder & Seller Protection Agreement',
  locked_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_standing_policies enable row level security;

drop policy if exists "anyone reads seller standing policies" on public.seller_standing_policies;
create policy "anyone reads seller standing policies" on public.seller_standing_policies
  for select to anon, authenticated using (true);

create or replace function public.upsert_seller_standing_policy(
  target_deposit_policy text,
  target_deposit_bps integer,
  target_guarantee_key text,
  target_contract_terms text,
  target_brand uuid default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  existing record;
  d_bps integer := coalesce(target_deposit_bps, 2000);
  d_pol text := coalesce(target_deposit_policy, 'refundable_until_inspection');
  c_terms text := coalesce(nullif(btrim(target_contract_terms), ''), 'Standard Scrlpets Ethical Breeder & Seller Protection Agreement');
begin
  if uid is null then raise exception 'auth_required'; end if;
  if d_bps < 0 or d_bps > 2500 then raise exception 'deposit_bps_out_of_bounds'; end if;
  if d_pol not in ('refundable_until_inspection', 'non_refundable_on_buyer_backing_out', 'custom_disclosed') then
    raise exception 'invalid_deposit_policy';
  end if;
  if target_guarantee_key is not null and not exists (
    select 1 from public.guarantee_templates where key = target_guarantee_key
  ) then
    raise exception 'invalid_guarantee_template';
  end if;

  select * into existing from public.seller_standing_policies where profile_id = uid;

  if found and now() < existing.locked_until then
    -- 30-Day Lock Rule: sellers cannot quietly tighten deposit refund terms or terms before 30 days
    if existing.deposit_refundable_policy <> d_pol
       or existing.default_deposit_bps <> d_bps
       or existing.contract_disclosure_terms <> c_terms then
      raise exception 'policy_locked_30_days';
    end if;
    update public.seller_standing_policies set
      brand_id = target_brand,
      default_guarantee_key = target_guarantee_key,
      updated_at = now()
    where profile_id = uid;
  else
    insert into public.seller_standing_policies (
      profile_id, brand_id, deposit_refundable_policy, default_deposit_bps,
      default_guarantee_key, contract_disclosure_terms, locked_until, updated_at
    )
    values (
      uid, target_brand, d_pol, d_bps, target_guarantee_key, c_terms,
      now() + interval '30 days', now()
    )
    on conflict (profile_id) do update set
      brand_id = excluded.brand_id,
      deposit_refundable_policy = excluded.deposit_refundable_policy,
      default_deposit_bps = excluded.default_deposit_bps,
      default_guarantee_key = excluded.default_guarantee_key,
      contract_disclosure_terms = excluded.contract_disclosure_terms,
      locked_until = now() + interval '30 days',
      updated_at = now();
  end if;
end; $fn$;
revoke execute on function public.upsert_seller_standing_policy(text, integer, text, text, uuid) from anon, public;
grant execute on function public.upsert_seller_standing_policy(text, integer, text, text, uuid) to authenticated;


-- Deal Contracts table
create table if not exists public.deal_contracts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  listing_id uuid not null references public.listings(id) on delete restrict,
  creature_id uuid references public.creatures(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  agreed_price_cents integer not null check (agreed_price_cents > 0),
  deposit_cents integer not null check (deposit_cents >= 0 and deposit_cents <= agreed_price_cents),
  deposit_policy_snapshot text not null,
  guarantee_headline_snapshot text not null,
  guarantee_body_snapshot text not null,
  guarantee_remedy_snapshot text,
  go_home_date date,
  contract_terms_snapshot text not null,
  seller_signature text not null,
  seller_signed_at timestamptz not null default now(),
  buyer_signature text,
  buyer_signed_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'signed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_deal_contracts_conv on public.deal_contracts(conversation_id);
create index if not exists idx_deal_contracts_listing on public.deal_contracts(listing_id);
create index if not exists idx_deal_contracts_seller on public.deal_contracts(seller_id);
create index if not exists idx_deal_contracts_buyer on public.deal_contracts(buyer_id);
create index if not exists idx_deal_contracts_order on public.deal_contracts(order_id);

alter table public.deal_contracts enable row level security;

drop policy if exists "deal parties read contract" on public.deal_contracts;
create policy "deal parties read contract" on public.deal_contracts
  for select to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()));

create or replace function public.send_deal_contract(
  target_conversation uuid,
  target_listing uuid,
  agreed_price integer,
  deposit_amount integer,
  go_home date,
  custom_notes text default null,
  seller_sig text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  other_party uuid;
  l record;
  policy record;
  g_text record;
  g_headline text := 'No health guarantee';
  g_body text := 'No health guarantee is offered on this listing.';
  g_remedy text := null;
  cid uuid;
  sig text := coalesce(nullif(btrim(seller_sig), ''), 'Signed by Seller');
  terms text;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if agreed_price is null or agreed_price <= 0 then raise exception 'invalid_price'; end if;
  if deposit_amount is null or deposit_amount < 0 or deposit_amount > agreed_price then
    raise exception 'invalid_deposit';
  end if;

  -- Verify conversation participation and determine the other party
  select case when user_a = uid then user_b else user_a end into other_party
    from public.conversations
   where id = target_conversation and (user_a = uid or user_b = uid);
  if other_party is null then raise exception 'conversation_not_found'; end if;

  select * into l from public.listings where id = target_listing and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.seller_id <> uid then raise exception 'not_the_seller'; end if;

  -- Snapshot guarantee text
  for g_text in select * from public.listing_guarantee_text(target_listing) limit 1 loop
    g_headline := g_text.headline;
    g_body := g_text.body;
    g_remedy := g_text.remedy;
  end loop;

  -- Snapshot seller policy
  select * into policy from public.seller_standing_policies where profile_id = uid;
  terms := coalesce(policy.contract_disclosure_terms, 'Standard Scrlpets Ethical Breeder & Seller Protection Agreement');
  if custom_notes is not null and btrim(custom_notes) <> '' then
    terms := terms || E'\n\nAddendum / Custom Notes:\n' || btrim(custom_notes);
  end if;

  insert into public.deal_contracts (
    conversation_id, listing_id, creature_id, seller_id, buyer_id,
    agreed_price_cents, deposit_cents, deposit_policy_snapshot,
    guarantee_headline_snapshot, guarantee_body_snapshot, guarantee_remedy_snapshot,
    go_home_date, contract_terms_snapshot, seller_signature, seller_signed_at, status
  )
  values (
    target_conversation, l.id, l.creature_id, uid, other_party,
    agreed_price, deposit_amount,
    coalesce(policy.deposit_refundable_policy, 'refundable_until_inspection'),
    g_headline, g_body, g_remedy,
    go_home, terms, sig, now(), 'sent'
  )
  returning id into cid;

  -- Post a message in the thread notifying buyer of contract offer
  insert into public.messages (conversation_id, sender_id, body)
  values (
    target_conversation,
    uid,
    '📄 Deal Contract Sent: agreed price ' || (agreed_price / 100)::text ||
    ' USD (Deposit ' || (deposit_amount / 100)::text || ' USD). Review & E-sign in Deal Room.'
  );

  return cid;
end; $fn$;
revoke execute on function public.send_deal_contract(uuid, uuid, integer, integer, date, text, text) from anon, public;
grant execute on function public.send_deal_contract(uuid, uuid, integer, integer, date, text, text) to authenticated;


-- ============================================================================
-- MODULE 4: Carrier Policies, Transport Surcharge, Quotes & Post-Sale Transfer
-- ============================================================================

alter table public.services
  add column if not exists payout_policy text not null default 'paid_on_show_up'
    check (payout_policy in ('paid_guaranteed', 'paid_on_show_up', 'paid_on_delivery')),
  add column if not exists policy_disclosure text;

alter table public.orders
  add column if not exists contract_id uuid references public.deal_contracts(id),
  add column if not exists transport_payout_policy text not null default 'paid_on_show_up'
    check (transport_payout_policy in ('paid_guaranteed', 'paid_on_show_up', 'paid_on_delivery')),
  add column if not exists transport_surcharge_cents integer not null default 0
    check (transport_surcharge_cents >= 0);

-- Column grants on orders for the newly added columns
grant select (contract_id, transport_payout_policy, transport_surcharge_cents)
  on public.orders to authenticated;

-- Order due cents includes transport surcharge if any
create or replace function public.order_due_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select o.amount_cents + o.transport_cents + coalesce(o.transport_surcharge_cents, 0) + o.buyer_fee_cents - o.buyer_fee_credit_cents
    from public.orders o where o.id = target_order;
$fn$;
revoke execute on function public.order_due_cents(uuid) from anon, public;
grant execute on function public.order_due_cents(uuid) to authenticated;

-- Transport quotes table
create table if not exists public.transport_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  service_id uuid not null references public.services(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  pickup_region text not null,
  delivery_region text not null,
  quoted_cents integer,
  surcharge_cents integer not null default 0,
  payout_policy_snapshot text not null default 'paid_on_show_up',
  target_pickup_date date,
  status text not null default 'requested' check (status in ('requested', 'quoted', 'accepted', 'declined')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tquotes_order on public.transport_quotes(order_id);
create index if not exists idx_tquotes_provider on public.transport_quotes(provider_id);
create index if not exists idx_tquotes_requester on public.transport_quotes(requester_id);

alter table public.transport_quotes enable row level security;

drop policy if exists "parties read transport quotes" on public.transport_quotes;
create policy "parties read transport quotes" on public.transport_quotes
  for select to authenticated
  using (requester_id = (select auth.uid()) or provider_id = (select auth.uid()));

create or replace function public.request_transport_quote(
  service_id uuid,
  pickup_reg text,
  delivery_reg text,
  target_date date default null,
  req_notes text default null,
  target_order uuid default null,
  target_conv uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  svc record;
  qid uuid;
  p_reg text := upper(btrim(coalesce(pickup_reg, '')));
  d_reg text := upper(btrim(coalesce(delivery_reg, '')));
begin
  if uid is null then raise exception 'auth_required'; end if;
  if p_reg = '' or d_reg = '' then raise exception 'route_required'; end if;

  select * into svc from public.services where id = service_id and active;
  if svc is null then raise exception 'service_not_found'; end if;
  if svc.category <> 'transport' then raise exception 'not_a_transport_service'; end if;
  if svc.owner_id = uid then raise exception 'cannot_quote_self'; end if;

  insert into public.transport_quotes (
    order_id, conversation_id, service_id, provider_id, requester_id,
    pickup_region, delivery_region, quoted_cents, surcharge_cents,
    payout_policy_snapshot, target_pickup_date, status, notes
  )
  values (
    target_order, target_conv, svc.id, svc.owner_id, uid,
    p_reg, d_reg, svc.price_cents,
    greatest(500, round(coalesce(svc.price_cents, 10000) * 0.05)::integer),
    svc.payout_policy, target_date, 'requested', nullif(btrim(req_notes), '')
  )
  returning id into qid;

  return qid;
end; $fn$;
revoke execute on function public.request_transport_quote(uuid, text, text, date, text, uuid, uuid) from anon, public;
grant execute on function public.request_transport_quote(uuid, text, text, date, text, uuid, uuid) to authenticated;

create or replace function public.respond_transport_quote(
  quote_id uuid,
  quoted_price integer,
  response_notes text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  q record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if quoted_price is null or quoted_price <= 0 then raise exception 'invalid_quoted_price'; end if;

  select * into q from public.transport_quotes where id = quote_id;
  if q is null then raise exception 'quote_not_found'; end if;
  if q.provider_id <> uid then raise exception 'not_the_provider'; end if;
  if q.status <> 'requested' then raise exception 'quote_not_in_requested_state'; end if;

  update public.transport_quotes set
    quoted_cents = quoted_price,
    surcharge_cents = greatest(500, round(quoted_price * 0.05)::integer),
    status = 'quoted',
    notes = coalesce(nullif(btrim(response_notes), ''), notes),
    updated_at = now()
  where id = quote_id;
end; $fn$;
revoke execute on function public.respond_transport_quote(uuid, integer, text) from anon, public;
grant execute on function public.respond_transport_quote(uuid, integer, text) to authenticated;

create or replace function public.accept_transport_quote(quote_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  q record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into q from public.transport_quotes where id = quote_id;
  if q is null then raise exception 'quote_not_found'; end if;
  if q.requester_id <> uid then raise exception 'not_the_requester'; end if;
  if q.status <> 'quoted' then raise exception 'quote_not_in_quoted_state'; end if;

  update public.transport_quotes set status = 'accepted', updated_at = now() where id = quote_id;

  if q.order_id is not null then
    update public.orders set
      transporter_id = q.provider_id,
      transport_cents = q.quoted_cents,
      transport_surcharge_cents = q.surcharge_cents,
      transport_payout_policy = q.payout_policy_snapshot,
      fulfilment = 'transported',
      pickup_region = q.pickup_region,
      delivery_region = q.delivery_region,
      updated_at = now()
    where id = q.order_id;
  end if;
end; $fn$;
revoke execute on function public.accept_transport_quote(uuid) from anon, public;
grant execute on function public.accept_transport_quote(uuid) to authenticated;


-- Contract Signing RPC
create or replace function public.sign_deal_contract(
  target_contract uuid,
  buyer_sig text,
  transport_service uuid default null,
  pickup_region text default null,
  delivery_region text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  c record;
  l record;
  svc record;
  oid uuid;
  b_bps integer; s_bps integer; b_fee integer; s_fee integer;
  hauler uuid := null; transport integer := 0; surcharge integer := 0; mode text := 'in_person';
  p_policy text := 'paid_on_show_up';
  from_r text := upper(btrim(coalesce(pickup_region, '')));
  to_r text := upper(btrim(coalesce(delivery_region, '')));
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if buyer_sig is null or btrim(buyer_sig) = '' then raise exception 'buyer_signature_required'; end if;

  select * into c from public.deal_contracts where id = target_contract;
  if c is null then raise exception 'contract_not_found'; end if;
  if c.buyer_id <> uid then raise exception 'not_the_buyer'; end if;
  if c.status <> 'sent' then raise exception 'contract_already_resolved'; end if;

  select * into l from public.listings where id = c.listing_id and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.availability <> 'available' then raise exception 'listing_unavailable'; end if;

  if l.creature_id is not null then
    if not public.is_verified_seller(l.seller_id) then raise exception 'seller_not_verified'; end if;
    if not public.is_animal_listable(l.creature_id) then raise exception 'animal_not_listable'; end if;
    if c.agreed_price_cents >= public.buyer_verification_threshold_cents()
       and not public.is_identity_verified(uid) then
      raise exception 'buyer_verification_required';
    end if;
  end if;

  if not public.can_receive_payouts(l.seller_id) then raise exception 'seller_cannot_receive_payouts'; end if;

  -- Transport handling
  if transport_service is not null then
    select * into svc from public.services where id = transport_service and active;
    if svc is null then raise exception 'transport_service_not_found'; end if;
    if svc.category <> 'transport' then raise exception 'not_a_transport_service'; end if;
    if not public.can_transport(svc.owner_id) then raise exception 'transporter_not_bookable'; end if;
    if svc.owner_id = uid or svc.owner_id = l.seller_id then
      raise exception 'transporter_cannot_be_a_party';
    end if;
    if from_r = '' or to_r = '' then raise exception 'route_required'; end if;
    if not exists (select 1 from public.transport_coverage where service_id = svc.id and region_code = from_r)
       or not exists (select 1 from public.transport_coverage where service_id = svc.id and region_code = to_r) then
      raise exception 'route_not_covered';
    end if;
    hauler := svc.owner_id;
    transport := coalesce(svc.price_cents, 0);
    surcharge := greatest(500, round(transport * 0.05)::integer);
    p_policy := coalesce(svc.payout_policy, 'paid_on_show_up');
    mode := 'transported';
  end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(l.seller_id);
  b_fee := least(round(c.agreed_price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(c.agreed_price_cents * s_bps / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, listing_id, contract_id, title_snapshot,
    amount_cents, currency, buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
    deposit_cents, inspection_hours, fulfilment, transporter_id,
    transport_cents, transport_surcharge_cents, transport_payout_policy,
    pickup_region, delivery_region
  )
  values (
    uid, l.seller_id, l.id, c.id, l.title,
    c.agreed_price_cents, l.currency, b_bps, s_bps, b_fee, s_fee,
    c.deposit_cents, greatest(coalesce(l.inspection_hours, 24), 24),
    mode, hauler, transport, surcharge, p_policy,
    nullif(from_r, ''), nullif(to_r, '')
  )
  returning id into oid;

  -- Mark contract signed and link order
  update public.deal_contracts set
    buyer_signature = btrim(buyer_sig),
    buyer_signed_at = now(),
    order_id = oid,
    status = 'signed'
  where id = target_contract;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft',
          'order created via signed contract; agreed price=' || c.agreed_price_cents ||
          ', deposit=' || c.deposit_cents ||
          case when hauler is null then '' else ', transport=' || transport || ' policy=' || p_policy end);

  return oid;
end; $fn$;
revoke execute on function public.sign_deal_contract(uuid, text, uuid, text, text) from anon, public;
grant execute on function public.sign_deal_contract(uuid, text, uuid, text, text) to authenticated;


-- Post-Sale Ownership Transfer, Alumni & Reservation Trigger
alter table public.alumni alter column application_id drop not null;
alter table public.alumni add column if not exists order_id uuid references public.orders(id) on delete cascade;

create or replace function public.process_order_state_transitions()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  l record;
  pair_exists boolean;
begin
  select * into l from public.listings where id = new.listing_id;

  -- 1. When an animal order is reserved (deposit held or funds held)
  if new.status in ('deposit_held', 'funds_held') and old.status is distinct from new.status then
    if l.creature_id is not null or l.sale_mode = 'contract_escrow' then
      update public.listings set availability = 'pending'
       where id = new.listing_id and availability = 'available';
    end if;
  end if;

  -- 2. When an animal order is completed/released:
  if new.status = 'released' and old.status is distinct from 'released' then
    if l.creature_id is not null then
      update public.listings set availability = 'sold' where id = new.listing_id;

      update public.creatures set owner_id = new.buyer_id
       where id = l.creature_id and owner_id = new.seller_id;

      -- Create alumni record for lineage and memorial continuity
      if not exists (select 1 from public.alumni where order_id = new.id) then
        insert into public.alumni (creature_id, breeder_id, owner_id, order_id, handover_at)
        values (l.creature_id, new.seller_id, new.buyer_id, new.id, coalesce(new.handover_at, now()));
      end if;

      -- Create accepted pack link
      select exists (
        select 1 from public.pack_links p
         where least(p.requester_id, p.addressee_id) = least(new.seller_id, new.buyer_id)
           and greatest(p.requester_id, p.addressee_id) = greatest(new.seller_id, new.buyer_id)
      ) into pair_exists;

      if not pair_exists and not exists (
        select 1 from public.blocks b
         where (b.blocker_id = new.seller_id and b.blocked_id = new.buyer_id)
            or (b.blocker_id = new.buyer_id and b.blocked_id = new.seller_id)
      ) then
        insert into public.pack_links
          (requester_id, addressee_id, status, origin, origin_creature_id, accepted_at)
        values (new.seller_id, new.buyer_id, 'accepted', 'handover', l.creature_id, now());
      end if;
    elsif l.sale_mode = 'contract_escrow' then
      update public.listings set availability = 'sold' where id = new.listing_id;
    end if;

    -- If transport was paid_on_delivery and not yet recorded, record it now
    if new.transporter_id is not null and new.transport_cents > 0 and not exists (
      select 1 from public.order_payouts where order_id = new.id and leg = 'transporter'
    ) then
      perform public.record_order_payout(new.id, new.transporter_id, 'transporter', new.transport_cents, null);
    end if;
  end if;

  return new;
end; $fn$;

drop trigger if exists trg_process_order_state_transitions on public.orders;
create trigger trg_process_order_state_transitions
after update of status on public.orders
for each row execute function public.process_order_state_transitions();


-- Carrier payout according to policy on confirm_pickup and confirm_handover:
create or replace function public.confirm_pickup(target_order uuid, scanned_anchor text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record; creature uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.fulfilment <> 'transported' then raise exception 'not_a_transported_order'; end if;
  if uid <> o.seller_id then raise exception 'not_the_seller'; end if;
  if o.status <> 'funds_held' then raise exception 'funds_not_held'; end if;
  if o.transporter_id is null then raise exception 'no_transporter'; end if;
  if o.delivery_address is null or btrim(o.delivery_address) = '' then
    raise exception 'delivery_address_required';
  end if;

  select l.creature_id into creature from public.listings l where l.id = o.listing_id;
  if creature is not null and exists (
    select 1 from public.creatures c where c.id = creature and c.anchor_value is not null
  ) then
    if not public.verify_creature_anchor(creature, scanned_anchor) then
      raise exception 'anchor_mismatch';
    end if;
  end if;

  update public.orders set
    status = 'dispatched', picked_up_at = now(), dispatched_at = now(), updated_at = now()
  where id = target_order;

  -- Payout policy enforcement: paid_on_show_up and paid_guaranteed are earned at pickup
  if o.transport_cents > 0 and o.transport_payout_policy in ('paid_on_show_up', 'paid_guaranteed') then
    if not exists (select 1 from public.order_payouts where order_id = target_order and leg = 'transporter') then
      perform public.record_order_payout(target_order, o.transporter_id, 'transporter', o.transport_cents, null);
    end if;
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'dispatched', 'anchor verified at pickup, custody to transporter');
end; $fn$;


-- ============================================================================
-- MODULE 5: Liability Shield & Verified Transaction Dossier
-- ============================================================================

create table if not exists public.seller_compliance_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legal_entity_name text not null,
  business_registration_number text,
  jurisdiction_state text not null,
  registered_address text not null,
  insurance_carrier text,
  insurance_policy_number text,
  dot_mc_number text,
  document_urls text[] not null default '{}',
  attested_liability_shield_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_compliance_profiles enable row level security;

drop policy if exists "compliance owner selects own" on public.seller_compliance_profiles;
create policy "compliance owner selects own" on public.seller_compliance_profiles
  for select to authenticated using (profile_id = (select auth.uid()));

drop policy if exists "compliance owner updates own" on public.seller_compliance_profiles;
create policy "compliance owner updates own" on public.seller_compliance_profiles
  for update to authenticated using (profile_id = (select auth.uid()));

drop policy if exists "compliance owner inserts own" on public.seller_compliance_profiles;
create policy "compliance owner inserts own" on public.seller_compliance_profiles
  for insert to authenticated with check (profile_id = (select auth.uid()));

create or replace function public.upsert_seller_compliance_profile(
  legal_name text,
  reg_num text,
  state_code text,
  address text,
  insurance_co text default null,
  policy_num text default null,
  dot_num text default null,
  doc_urls text[] default '{}'
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  if legal_name is null or btrim(legal_name) = '' then raise exception 'legal_entity_name_required'; end if;
  if state_code is null or btrim(state_code) = '' then raise exception 'jurisdiction_state_required'; end if;
  if address is null or btrim(address) = '' then raise exception 'registered_address_required'; end if;

  insert into public.seller_compliance_profiles (
    profile_id, legal_entity_name, business_registration_number, jurisdiction_state,
    registered_address, insurance_carrier, insurance_policy_number, dot_mc_number,
    document_urls, attested_liability_shield_at, updated_at
  )
  values (
    uid, btrim(legal_name), nullif(btrim(reg_num), ''), upper(btrim(state_code)),
    btrim(address), nullif(btrim(insurance_co), ''), nullif(btrim(policy_num), ''),
    nullif(btrim(dot_num), ''), coalesce(doc_urls, '{}'), now(), now()
  )
  on conflict (profile_id) do update set
    legal_entity_name = excluded.legal_entity_name,
    business_registration_number = excluded.business_registration_number,
    jurisdiction_state = excluded.jurisdiction_state,
    registered_address = excluded.registered_address,
    insurance_carrier = excluded.insurance_carrier,
    insurance_policy_number = excluded.insurance_policy_number,
    dot_mc_number = excluded.dot_mc_number,
    document_urls = excluded.document_urls,
    attested_liability_shield_at = now(),
    updated_at = now();
end; $fn$;
revoke execute on function public.upsert_seller_compliance_profile(text, text, text, text, text, text, text, text[]) from anon, public;
grant execute on function public.upsert_seller_compliance_profile(text, text, text, text, text, text, text, text[]) to authenticated;


-- Counterparty Dossier RPC
create or replace function public.order_counterparty_dossier(target_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  c record;
  l record;
  crt record;
  s_username text;
  b_username text;
  s_legal_name text := null;
  s_reg_num text := null;
  s_state text := null;
  s_address text := null;
  s_insurance_co text := null;
  s_policy_num text := null;
  t_username text := null;
  t_legal_name text := null;
  t_state text := null;
  t_dot text := null;
  t_cred text := null;
  t_auth text := null;
  due integer;
  captured integer;
  evt_count integer;
  payout_count integer;
begin
  if uid is null then raise exception 'auth_required'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'order_not_found'; end if;

  -- Gated to order parties or platform admin
  if uid not in (o.buyer_id, o.seller_id, coalesce(o.transporter_id, '00000000-0000-0000-0000-000000000000'::uuid))
     and not public.is_platform_admin() then
    raise exception 'access_denied';
  end if;

  -- Only unlocked once transaction reaches at least deposit_held / funds_held / disputed / released / refunded
  if o.status in ('draft', 'awaiting_payment', 'cancelled') then
    raise exception 'dossier_not_yet_available';
  end if;

  select * into l from public.listings where id = o.listing_id;
  select * into c from public.deal_contracts where id = o.contract_id;
  select id, name, species, anchor_type into crt from public.creatures where id = l.creature_id;

  select username into s_username from public.profiles where id = o.seller_id;
  select username into b_username from public.profiles where id = o.buyer_id;

  select legal_entity_name, business_registration_number, jurisdiction_state, registered_address, insurance_carrier, insurance_policy_number
    into s_legal_name, s_reg_num, s_state, s_address, s_insurance_co, s_policy_num
    from public.seller_compliance_profiles where profile_id = o.seller_id;

  if o.transporter_id is not null then
    select username into t_username from public.profiles where id = o.transporter_id;
    select legal_entity_name, jurisdiction_state, dot_mc_number
      into t_legal_name, t_state, t_dot
      from public.seller_compliance_profiles where profile_id = o.transporter_id;
    select credential_number, issuing_authority
      into t_cred, t_auth
      from public.seller_programs where profile_id = o.transporter_id and program_type = 'transporter' and status = 'approved' limit 1;
  end if;

  due := public.order_due_cents(target_order);
  captured := public.order_captured_cents(target_order);
  select count(*) into evt_count from public.order_events where order_id = target_order;
  select count(*) into payout_count from public.order_payouts where order_id = target_order;

  return jsonb_build_object(
    'order_id', o.id,
    'status', o.status,
    'title_snapshot', o.title_snapshot,
    'amount_cents', o.amount_cents,
    'deposit_cents', o.deposit_cents,
    'transport_cents', o.transport_cents,
    'transport_surcharge_cents', o.transport_surcharge_cents,
    'currency', o.currency,
    'fulfilment', o.fulfilment,
    'created_at', o.created_at,
    'picked_up_at', o.picked_up_at,
    'handover_at', o.handover_at,
    'delivered_at', o.delivered_at,
    'contract', case when c is null then null else jsonb_build_object(
      'contract_id', c.id,
      'status', c.status,
      'agreed_price_cents', c.agreed_price_cents,
      'deposit_cents', c.deposit_cents,
      'deposit_policy', c.deposit_policy_snapshot,
      'guarantee_headline', c.guarantee_headline_snapshot,
      'guarantee_body', c.guarantee_body_snapshot,
      'guarantee_remedy', c.guarantee_remedy_snapshot,
      'go_home_date', c.go_home_date,
      'terms', c.contract_terms_snapshot,
      'seller_signature', c.seller_signature,
      'seller_signed_at', c.seller_signed_at,
      'buyer_signature', c.buyer_signature,
      'buyer_signed_at', c.buyer_signed_at
    ) end,
    'seller', jsonb_build_object(
      'username', s_username,
      'legal_entity_name', s_legal_name,
      'registration_number', s_reg_num,
      'state', s_state,
      'registered_address', s_address,
      'insurance_carrier', s_insurance_co,
      'insurance_policy_number', s_policy_num
    ),
    'buyer', jsonb_build_object(
      'username', b_username
    ),
    'transporter', case when o.transporter_id is null then null else jsonb_build_object(
      'username', t_username,
      'legal_entity_name', t_legal_name,
      'state', t_state,
      'dot_mc_number', t_dot,
      'payout_policy', o.transport_payout_policy,
      'credential_number', t_cred,
      'issuing_authority', t_auth
    ) end,
    'creature', case when crt is null then null else jsonb_build_object(
      'id', crt.id,
      'name', crt.name,
      'species', crt.species,
      'anchor_type', crt.anchor_type
    ) end,
    'ledger', jsonb_build_object(
      'due_cents', due,
      'captured_cents', captured,
      'buyer_fee_cents', o.buyer_fee_cents,
      'seller_fee_cents', o.seller_fee_cents,
      'payout_legs_count', payout_count
    ),
    'audit', jsonb_build_object(
      'immutable_events_count', evt_count
    )
  );
end; $fn$;
revoke execute on function public.order_counterparty_dossier(uuid) from anon, public;
grant execute on function public.order_counterparty_dossier(uuid) to authenticated;
