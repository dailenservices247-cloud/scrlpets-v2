-- Referrals: the other half of earning, built so an invite only pays when it
-- brought a real participant.
--
-- Legacy paid 100 points the moment somebody signed up with a code. That is a
-- faucet, not a referral programme: an email address costs nothing, so the
-- rational move is to farm accounts rather than invite people. Nothing here
-- pays on signup. A referral pays exactly once, when the invited person does
-- something the marketplace actually wanted — publishes a listing, or
-- completes a handover both parties confirmed.
--
-- Everything that writes is a definer. `referrals` has no client write policy
-- at all, for the same reason `point_ledger` has none: the row that decides
-- whether points are owed must not be authorable by the party being paid.

-- ================================================================== CODES
create table if not exists public.referral_codes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  created_at timestamptz default now() not null,
  constraint referral_codes_pkey primary key (profile_id),
  constraint referral_codes_code_unique unique (code)
);

alter table public.referral_codes enable row level security;
-- Own-read only. A code is a bearer token for attribution — publishing the
-- whole table would let anyone claim anyone as their referrer.
create policy "own read referral code" on public.referral_codes
for select to authenticated using (profile_id = (select auth.uid()));

-- Mints the CALLER's own code, or returns the one they already have. Idempotent
-- so the settings page can simply ask for it; codes are never minted for the
-- overwhelming majority of accounts that never invite anybody.
--
-- gen_random_uuid() is core Postgres, so this does not depend on pgcrypto being
-- reachable from search_path = public.
create or replace function public.ensure_referral_code()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'auth_required'; end if;
  -- 8 hex chars is 4.3e9 codes; the loop exists for the collision that space
  -- still allows, and for two concurrent calls racing to mint the same user's.
  for i in 1..5 loop
    select rc.code into c from public.referral_codes rc where rc.profile_id = uid;
    if c is not null then return c; end if;
    begin
      insert into public.referral_codes (profile_id, code)
      values (uid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
      returning code into c;
      return c;
    exception when unique_violation then
      null; -- the next pass re-reads: either ours landed, or we pick again
    end;
  end loop;
  raise exception 'code_generation_failed';
end; $fn$;
revoke execute on function public.ensure_referral_code() from anon, public;
grant execute on function public.ensure_referral_code() to authenticated;

-- ============================================================== ATTRIBUTION
create table if not exists public.referrals (
  id uuid default gen_random_uuid() not null,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  created_at timestamptz default now() not null,
  converted_at timestamptz,
  constraint referrals_pkey primary key (id),
  -- One referrer per person, for life. Without this the same account could be
  -- "referred" by a rotating cast and pay out over and over.
  constraint referrals_one_per_referred unique (referred_id),
  constraint referrals_not_self check (referrer_id <> referred_id)
);
create index if not exists idx_referrals_referrer
  on public.referrals (referrer_id, created_at desc);

alter table public.referrals enable row level security;
-- Both sides can see the row that concerns them. No insert, update or delete
-- policy for any client role: only claim_referral and the conversion trigger
-- write here.
create policy "read own referrals" on public.referrals
for select to authenticated
using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));

-- Records who invited the CALLING user. Refuses, in order: signed-out, a
-- suspended caller, a code nobody owns, your own code, a second referrer, and
-- an account that was already active before the claim.
--
-- That last one is the non-obvious guard. Without it two established members
-- can trade codes and convert immediately off activity that was going to
-- happen anyway — a referral that referred nobody. Requiring a blank history
-- is what makes "referred" mean "would not be here otherwise".
create or replace function public.claim_referral(code text)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  owner_id uuid;
  -- Local, so nothing below has to reference the ambiguous parameter name.
  wanted text := upper(btrim(coalesce(code, '')));
begin
  if uid is null then raise exception 'auth_required'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;
  if wanted = '' then raise exception 'unknown_code'; end if;

  select rc.profile_id into owner_id from public.referral_codes rc where rc.code = wanted;
  if owner_id is null then raise exception 'unknown_code'; end if;
  if owner_id = uid then raise exception 'self_referral'; end if;

  if exists (select 1 from public.referrals r where r.referred_id = uid) then
    raise exception 'already_referred';
  end if;

  -- No `deleted_at is null` filter on purpose: a deleted listing is still
  -- proof the account was already here, and this guard is about history.
  if exists (select 1 from public.listings l where l.seller_id = uid)
     or exists (
       select 1 from public.buyer_applications a
        where (a.buyer_id = uid or a.seller_id = uid)
          and a.buyer_confirmed_at is not null
          and a.seller_confirmed_at is not null
     )
  then raise exception 'already_active'; end if;

  insert into public.referrals (referrer_id, referred_id, code)
  values (owner_id, uid, wanted)
  on conflict (referred_id) do nothing;
end; $fn$;
revoke execute on function public.claim_referral(text) from anon, public;
grant execute on function public.claim_referral(text) to authenticated;

-- ============================================================== CONVERSION
-- The only place a referral pays. Three independent things stop a double
-- payment, because this is the surface somebody would attack:
--   1. `converted_at is null` in the UPDATE — the row converts once.
--   2. That UPDATE is the guard AND the claim, in one statement, so two
--      concurrent triggers cannot both see an unconverted row.
--   3. ref_id = the referral row id, so the rewards unique index refuses a
--      second ledger entry for this referral even if 1 and 2 were bypassed.
--
-- 250 points = one boost. A converted referral brought a whole participant, so
-- it is worth more than any single act by one person.
--
-- Only the referrer is paid. The invited person is already paid by the
-- existing rules for the same act (200 first listing / 150 handover); paying
-- them again here would be paying twice for one behaviour.
create or replace function public.convert_referral(referred uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  r record;
begin
  if referred is null then return; end if;

  update public.referrals
     set converted_at = now()
   where referred_id = referred and converted_at is null
  returning * into r;
  if not found then return; end if;

  -- A suspended referrer does not collect. Suspension is usually how farming
  -- gets caught, and paying the account we just caught would be absurd.
  if public.is_suspended(r.referrer_id) then return; end if;

  perform public.award_points(r.referrer_id, 250, 'referral_converted', 'referral', r.id);
end; $fn$;
revoke execute on function public.convert_referral(uuid) from anon, authenticated, public;

-- Conversion 1: the invited person publishes a listing. No "is this their
-- first?" check is needed — claim_referral refuses accounts that already have
-- one, so the first listing after a claim is the first listing, and a referral
-- can only convert once regardless.
create or replace function public.referral_on_listing()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.convert_referral(new.seller_id);
  return new;
end; $fn$;
create trigger referral_convert_listing
after insert on public.listings
for each row execute function public.referral_on_listing();

-- Conversion 2: a handover both parties confirmed. Either party may be the
-- invited one, so both are offered; convert_referral ignores anyone without an
-- open referral.
create or replace function public.referral_on_handover()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null then
    perform public.convert_referral(new.buyer_id);
    perform public.convert_referral(new.seller_id);
  end if;
  return new;
end; $fn$;
create trigger referral_convert_handover
after update on public.buyer_applications
for each row execute function public.referral_on_handover();

-- Trigger functions are never called directly by an application role.
revoke execute on function public.referral_on_listing() from anon, authenticated;
revoke execute on function public.referral_on_handover() from anon, authenticated;

-- Residual risk, written down rather than pretended away: one person can still
-- create a second account and publish one listing from it to pay themselves
-- 250. That costs a distinct email plus a real listing, and both accounts are
-- traceable through `referrals`. If it shows up in the data, the lever is to
-- require the invited person to be identity-verified before converting — one
-- extra condition in convert_referral, no schema change.
