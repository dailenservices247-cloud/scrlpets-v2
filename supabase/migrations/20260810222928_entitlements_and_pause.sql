-- Step 5a: what the subscription unlocks, and the pause that makes long terms
-- worth buying.
--
-- THE PRINCIPLE: free means you can sell, paid means you can be seen. Free
-- sellers pay 5% — they are revenue, not freeloaders. So this gates
-- amplification and never participation.
--
-- WHAT IS DELIBERATELY NOT GATED, and must never be: listing an animal at all;
-- messaging a buyer; anything inside a live transaction including dispute
-- participation; verification badges, assurance level, the anchor and
-- guarantee display; reviews and standing; reading and browsing.
--
-- Trust signals are not purchasable. Legacy sold exactly these — tier-gated
-- health guarantees and a "Verified Breeder" badge on every listing. The moment
-- a badge means "paid", every badge means nothing. Pack links and lineage stay
-- free for the same reason: they carry provenance, which is trust data.
--
-- THE PAUSE, and the one rule that makes it safe: A PAUSED SUBSCRIPTION PAYS
-- FREE-TIER FEES. That single fact makes pausing self-policing — a seller who
-- sells while paused pays MORE, not less, so pausing is only attractive during
-- the dead months when they were generating no fees anyway. It converts a
-- cancellation into a renewal at almost no cost.

-- ============================================================== TERMS
alter table public.subscription_tiers
  add column if not exists term_months integer not null default 1,
  add column if not exists pause_count_allowed integer not null default 0,
  add column if not exists pause_months_allowed integer not null default 0;

insert into public.subscription_tiers
  (key, name, monthly_price_cents, fee_bps, description, sort_order, enabled,
   term_months, pause_count_allowed, pause_months_allowed)
values
  ('pro_6mo', 'Pro — 6 months', 14900, 250,
   'Six months of Pro paid up front, about 17% below monthly. Includes one pause of up to 6 months for when you have nothing for sale.',
   3, true, 6, 1, 6),
  ('pro_12mo', 'Pro — 12 months', 27900, 250,
   'A year of Pro paid up front, about 22% below monthly. Includes two pauses totalling up to 12 months, so a year can stretch across two.',
   4, true, 12, 2, 12)
on conflict (key) do update set
  monthly_price_cents = excluded.monthly_price_cents,
  fee_bps = excluded.fee_bps,
  description = excluded.description,
  term_months = excluded.term_months,
  pause_count_allowed = excluded.pause_count_allowed,
  pause_months_allowed = excluded.pause_months_allowed;

alter table public.subscriptions
  add column if not exists paused_at timestamptz,
  add column if not exists pauses_used integer not null default 0,
  add column if not exists paused_months_used integer not null default 0;

-- ======================================================== ENTITLEMENTS
create table if not exists public.tier_entitlements (
  tier_key text not null references public.subscription_tiers(key) on delete cascade,
  entitlement_key text not null,
  constraint tier_entitlements_pkey primary key (tier_key, entitlement_key)
);
alter table public.tier_entitlements enable row level security;
-- Readable so the UI can say honestly what a plan includes. No write policy:
-- what a plan unlocks is a product decision, not a client call.
create policy "read tier entitlements" on public.tier_entitlements
for select to anon, authenticated using (true);

insert into public.tier_entitlements (tier_key, entitlement_key)
select t.key, e.k
  from (values ('pro'), ('pro_6mo'), ('pro_12mo')) as t(key),
       (values ('boost'), ('brand_page'), ('sell_merch'), ('create_group'),
               ('publish_guide'), ('featured_placement'), ('analytics')) as e(k)
on conflict do nothing;

/**
 * Paused or not. A pause is a state, not a cancellation: the row stays, the
 * term clock stops, and everything the seller made stays where it was.
 */
create or replace function public.is_subscription_paused(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.subscriptions s
     where s.profile_id = target_profile
       and s.status = 'active'
       and s.paused_at is not null
  );
$fn$;
revoke execute on function public.is_subscription_paused(uuid) from anon, public;
grant execute on function public.is_subscription_paused(uuid) to authenticated;

/**
 * The single gate. Every paywalled feature asks this and nothing else, so there
 * is no second place where "is this person Pro" gets decided differently.
 *
 * Returns false when paused — that is what gives the pause teeth. A seller who
 * wants to promote, collaborate or run their storefront has to come back on,
 * which is precisely the seller who was never going to pause anyway.
 */
create or replace function public.has_entitlement(target_profile uuid, key text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from public.subscriptions s
      join public.tier_entitlements te on te.tier_key = s.tier_key
     where s.profile_id = target_profile
       and s.status = 'active'
       and s.paused_at is null
       and (s.current_period_end is null or s.current_period_end > now())
       and te.entitlement_key = key
  );
$fn$;
revoke execute on function public.has_entitlement(uuid, text) from anon, public;
grant execute on function public.has_entitlement(uuid, text) to authenticated;

/**
 * A paused subscription pays the FREE rate. This is the whole safety of the
 * pause model expressed in one clause — without it a seller could pause, sell a
 * litter at 2.5%, and pause again, paying for Pro only during the months they
 * were not using it.
 */
create or replace function public.seller_fee_bps_for(target_profile uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select t.fee_bps
       from public.subscriptions s
       join public.subscription_tiers t on t.key = s.tier_key
      where s.profile_id = target_profile
        and s.status = 'active'
        and s.paused_at is null
        and (s.current_period_end is null or s.current_period_end > now())
        and t.enabled
      order by t.fee_bps asc
      limit 1),
    (select t.fee_bps from public.subscription_tiers t where t.key = 'free'),
    500
  );
$fn$;
revoke execute on function public.seller_fee_bps_for(uuid) from anon, public;
grant execute on function public.seller_fee_bps_for(uuid) to authenticated;

-- ============================================================== PAUSING
/**
 * Pause your own subscription for a whole number of months.
 *
 * The guards, and why each exists:
 *   - the plan must ALLOW pauses, and the seller must have one left
 *   - the total months paused may not exceed the plan's allowance
 *   - 30 days active before the first pause, so a plan cannot be bought and
 *     immediately parked
 *   - NO ORDER IN FLIGHT. A seller mid-sale has a frozen fee rate on that order
 *     and a buyer waiting; pausing there changes nothing about the order and
 *     everything about what the seller can see, which is confusing at exactly
 *     the wrong moment.
 *
 * The term end is pushed out by the paused months on resume, not here — a
 * seller who resumes early should not lose the difference.
 */
create or replace function public.pause_subscription(months integer)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  s record;
  t record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if months is null or months < 1 then raise exception 'months_must_be_positive'; end if;

  select * into s from public.subscriptions
   where profile_id = uid and status = 'active' limit 1;
  if s is null then raise exception 'no_active_subscription'; end if;
  if s.paused_at is not null then raise exception 'already_paused'; end if;

  select * into t from public.subscription_tiers where key = s.tier_key;
  if t.pause_count_allowed <= 0 then raise exception 'plan_does_not_allow_pausing'; end if;
  if s.pauses_used >= t.pause_count_allowed then raise exception 'no_pauses_remaining'; end if;
  if s.paused_months_used + months > t.pause_months_allowed then
    raise exception 'pause_allowance_exceeded';
  end if;
  if s.created_at > now() - interval '30 days' then
    raise exception 'too_soon_to_pause';
  end if;

  if exists (
    select 1 from public.orders o
     where (o.seller_id = uid or o.buyer_id = uid)
       and o.status in ('awaiting_payment','deposit_held','funds_held','dispatched','inspection','disputed')
  ) then raise exception 'order_in_flight'; end if;

  update public.subscriptions set
    paused_at = now(),
    pauses_used = pauses_used + 1,
    paused_months_used = paused_months_used + months
  where id = s.id;
end; $fn$;
revoke execute on function public.pause_subscription(integer) from anon, public;
grant execute on function public.pause_subscription(integer) to authenticated;

/**
 * Come back on. The term end moves out by however long the pause actually ran,
 * so paused time is genuinely not spent rather than merely deferred.
 */
create or replace function public.resume_subscription()
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); s record; elapsed interval;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into s from public.subscriptions
   where profile_id = uid and status = 'active' limit 1;
  if s is null then raise exception 'no_active_subscription'; end if;
  if s.paused_at is null then raise exception 'not_paused'; end if;

  elapsed := now() - s.paused_at;
  update public.subscriptions set
    paused_at = null,
    current_period_end = case
      when current_period_end is null then null
      else current_period_end + elapsed
    end
  where id = s.id;
end; $fn$;
revoke execute on function public.resume_subscription() from anon, public;
grant execute on function public.resume_subscription() to authenticated;
