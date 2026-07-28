-- Subscription tiers — the primary revenue model. Built, seeded, and OFF.
--
-- A tier changes ONE thing: the FEE RATE the seller pays on a completed sale.
-- It never changes WHO pays. A buyer must never see a different price because
-- of the seller's plan, so nothing here touches orders.fee_payer, which stays
-- 'seller' for everyone (D12).
--
-- FOUR THINGS DELIBERATELY DO NOT EXIST IN THIS SCHEMA:
--   * A listing quota. No column caps how many animals a member may list, and
--     none is coming: a paywall in front of publishing pushes sellers off
--     platform, which is where unverified animal sales already happen.
--   * A rebate. Points and plans reduce a rate; neither pays money back.
--   * A ranking weight. A plan buys no position in any feed or search result.
--   * A trust contribution. Paying changes a rate, never a standing signal.
--
-- Like the payment rails (D10), the switch is a DB row rather than a UI
-- condition: subscribe_to_tier raises 'subscriptions_disabled' until the flag
-- flips, so a leaked client or a bypassed server action still cannot start a
-- plan. A3 (legal review) is the real gate.
insert into public.platform_flags (key, enabled) values ('subscriptions_enabled', false)
on conflict (key) do nothing;

-- ================================================================= CATALOG
-- Public because the pricing page must be honest about what a plan costs and
-- what rate it buys, whether or not anyone can subscribe yet. No write policy:
-- pricing is an admin/DB decision, never a client call.
create table if not exists public.subscription_tiers (
  key text not null,
  name text not null,
  monthly_price_cents integer not null,
  fee_bps integer not null,
  description text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  constraint subscription_tiers_pkey primary key (key),
  constraint subscription_tiers_price_nonneg check (monthly_price_cents >= 0),
  constraint subscription_tiers_fee_bps_range check (fee_bps >= 0 and fee_bps <= 10000)
);
alter table public.subscription_tiers enable row level security;
create policy "public read subscription tiers" on public.subscription_tiers
for select to anon, authenticated using (true);

-- The rates below are ILLUSTRATIVE and inert. create_order still computes the
-- fee from the global public.fee_bps() flag, which is 0 — nothing reads a
-- tier's fee_bps to price anything. Wiring the per-seller rate is a separate
-- change that needs both a real number from Dailen and payments_enabled on.
insert into public.subscription_tiers (key, name, monthly_price_cents, fee_bps, description, sort_order, enabled) values
  ('free', 'Free', 0, 600,
   'Everything on Scrlpets, with the standard fee on each completed sale. Listing is never limited.', 0, true),
  ('pro', 'Pro', 2999, 300,
   'A lower fee on each completed sale. Same listings, same reach, same fee payer — only the rate changes.', 1, true)
on conflict (key) do nothing;

-- =========================================================== SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tier_key text not null references public.subscription_tiers(key),
  status text not null default 'inactive',
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz default now() not null,
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_status_check check (
    status = any (array['inactive','active','past_due','cancelled'])
  )
);
-- One live plan per member, enforced here rather than in app code: two active
-- rows would make "which rate applies" ambiguous at the moment money moves.
create unique index if not exists idx_subscriptions_one_active
  on public.subscriptions (profile_id) where status = 'active';
create index if not exists idx_subscriptions_profile
  on public.subscriptions (profile_id, created_at desc);

alter table public.subscriptions enable row level security;
-- Own read only. NO client insert/update/delete policy at all: a plan starts
-- when a payment processor says so, never because a client asked.
create policy "own read subscriptions" on public.subscriptions
for select to authenticated using (profile_id = (select auth.uid()));

-- The only way to start a plan. Complete but inert while the flag is off.
create or replace function public.subscribe_to_tier(tier text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  t record;
  sid uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('subscriptions_enabled') then raise exception 'subscriptions_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into t from public.subscription_tiers where key = tier;
  if t is null then raise exception 'unknown_tier'; end if;
  if not t.enabled then raise exception 'tier_not_available'; end if;

  -- Records intent only. Billing is Stripe's, and it is not wired: the row
  -- lands 'inactive' with no period end so nothing downstream can mistake a
  -- request to subscribe for a paid, live plan.
  insert into public.subscriptions (profile_id, tier_key, status)
  values (uid, tier, 'inactive')
  returning id into sid;
  return sid;
end; $fn$;
revoke execute on function public.subscribe_to_tier(text) from anon, public;
grant execute on function public.subscribe_to_tier(text) to authenticated;
