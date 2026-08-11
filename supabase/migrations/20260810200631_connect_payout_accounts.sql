-- Step 1 of the money architecture: the payout rail.
--
-- Legacy HAD this (`profiles.stripe_account_id`, `stripe-connect-onboard`,
-- `stripe-connect-status`) and v2 dropped it. Earlier audits recorded that as a
-- missing feature; it is a REGRESSION. Restoring it is the precondition for
-- everything else — until a seller can receive money, no charge can be split, no
-- transfer can land, and the whole state machine describes a payment that cannot
-- complete.
--
-- NOT on `profiles`, deliberately. That table still carries a TABLE-LEVEL SELECT
-- grant to anon and authenticated, so any column added there is world-readable
-- the moment it exists. Re-plumbing grants on the most-read table in the app to
-- hide one column is a large blast radius for a small need, and a connected
-- account id has no business being public: it reveals which members have taken
-- money, which is nobody's business but theirs. Its own table with its own RLS
-- costs one join and removes the whole class of mistake.

create table if not exists public.seller_payout_accounts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stripe_account_id text not null,
  -- Stripe's own three signals. `payouts_enabled` is the one that matters for
  -- releasing money; `details_submitted` distinguishes "never started" from
  -- "started and still under review", which is the difference between two very
  -- different things to tell a seller.
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_due text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payout_accounts_pkey primary key (profile_id),
  constraint seller_payout_accounts_stripe_id_unique unique (stripe_account_id)
);

alter table public.seller_payout_accounts enable row level security;

-- Owner reads their own row. No INSERT, UPDATE or DELETE policy exists for any
-- client role at all: this table is written only by Stripe's account.updated
-- webhook through the definer below. A seller must not be able to assert that
-- their own payouts are enabled — that claim belongs to Stripe.
create policy "read own payout account" on public.seller_payout_accounts
for select to authenticated
using (profile_id = (select auth.uid()));

/**
 * The public-safe signal. Returns a boolean and never the account id, so a
 * listing page, a buyer, or a gate can ask "can this seller actually be paid?"
 * without learning anything else about them.
 */
create or replace function public.can_receive_payouts(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.seller_payout_accounts a
     where a.profile_id = target_profile and a.payouts_enabled
  );
$fn$;
revoke execute on function public.can_receive_payouts(uuid) from public;
grant execute on function public.can_receive_payouts(uuid) to anon, authenticated;

/**
 * What the seller sees on their own settings page: enough to know whether to
 * start onboarding, resume it, or do nothing. Returns null when they have never
 * started, which the UI must render as an explicit "not set up" rather than an
 * absence — same rule as ListingVerificationPanel.
 */
create or replace function public.my_payout_account()
returns table (
  stripe_account_id text,
  charges_enabled boolean,
  payouts_enabled boolean,
  details_submitted boolean,
  requirements_due text[]
)
language sql stable security definer set search_path = public as $fn$
  select a.stripe_account_id, a.charges_enabled, a.payouts_enabled,
         a.details_submitted, a.requirements_due
    from public.seller_payout_accounts a
   where a.profile_id = (select auth.uid());
$fn$;
revoke execute on function public.my_payout_account() from anon, public;
grant execute on function public.my_payout_account() to authenticated;

/**
 * The only writer. Called by the Stripe webhook with the service key on
 * `account.updated`, and by the onboarding route immediately after creating the
 * account so the id is recorded before the seller is redirected — otherwise a
 * seller who abandons onboarding leaves an orphaned Stripe account and gets a
 * second one on their next attempt.
 *
 * Not executable by any client role: the enabled flags are Stripe's assertion,
 * not the seller's.
 */
create or replace function public.upsert_payout_account(
  target_profile uuid,
  account_id text,
  charges boolean default false,
  payouts boolean default false,
  submitted boolean default false,
  requirements text[] default '{}'
)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if target_profile is null or account_id is null or btrim(account_id) = '' then
    raise exception 'profile_and_account_required';
  end if;

  insert into public.seller_payout_accounts as a
    (profile_id, stripe_account_id, charges_enabled, payouts_enabled,
     details_submitted, requirements_due)
  values (target_profile, account_id, charges, payouts, submitted, coalesce(requirements, '{}'))
  on conflict (profile_id) do update set
    stripe_account_id = excluded.stripe_account_id,
    charges_enabled   = excluded.charges_enabled,
    payouts_enabled   = excluded.payouts_enabled,
    details_submitted = excluded.details_submitted,
    requirements_due  = excluded.requirements_due,
    updated_at        = now();
end; $fn$;
revoke execute on function public.upsert_payout_account(uuid, text, boolean, boolean, boolean, text[])
  from anon, authenticated, public;

-- ============================================================== THE GATE
/**
 * An animal listing needs a working payout account — otherwise a buyer can pay
 * for an animal whose seller has no way to receive the money, and the funds sit
 * in the platform balance with nowhere to go.
 *
 * RESTRICTIVE and flag-conditional, deliberately. Restrictive so it ANDs with
 * the existing "own insert listings" policy rather than replacing it (that
 * policy carries the verified-seller and animal-listable checks and is not this
 * migration's business). Flag-conditional so it is completely inert while
 * `payments_enabled` is false — today every seller would fail it, including the
 * E2E fixtures, and gating a flow that cannot take money anyway would be a
 * regression dressed up as safety. It arms itself the moment payments do.
 */
drop policy if exists "animal listings need a payout account" on public.listings;
create policy "animal listings need a payout account" on public.listings
as restrictive for insert to authenticated
with check (
  creature_id is null
  or not public.is_flag_enabled('payments_enabled')
  or public.can_receive_payouts((select auth.uid()))
);

create index if not exists idx_payout_accounts_enabled
  on public.seller_payout_accounts (profile_id) where payouts_enabled;
