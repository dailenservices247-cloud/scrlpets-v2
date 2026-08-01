-- Standing is EARNED. Balance is SPENT. They are not the same number.
--
-- Legacy computed a five-rung ladder (Bronze→Diamond) from the member's CURRENT
-- POINT BALANCE, and rewards were paid out of that same balance. So redeeming a
-- reward demoted you: the ladder punished the one action the catalogue existed
-- to encourage. That is a defect, not a design, and it does not come back.
--
-- The split:
--   BALANCE  = sum(delta) over the whole ledger. Goes down when you spend.
--   STANDING = a count of the EARNING EVENTS that cannot be produced alone,
--              plus capped account tenure. Has no debit term at all, so
--              spending cannot reduce it — not "is unlikely to", cannot.
--
-- WHY THESE INPUTS (schema inspected on dev before choosing, not assumed):
--
--   completed handovers  — public.point_ledger rows with reason
--     'handover_confirmed'. Written by a trigger when BOTH parties confirm, so
--     it needs a counterparty; nobody can post their way to one. Sourced from
--     the ledger rather than from buyer_applications because the ledger is
--     append-only (no client INSERT/UPDATE/DELETE policy) while an application
--     row is not, and standing that can fall is the bug we are fixing.
--
--   reviews received     — ledger rows with reason 'review_received', added
--     below. Deliberately NOT counted off public.reviews: migration
--     20260728064506 gave the review AUTHOR a DELETE policy, so a live count
--     drops the moment a buyer retracts. A seller's standing must not be a
--     thing a buyer can take back.
--
--   account tenure       — whole months since auth.users.created_at, CAPPED AT
--     12. The cap is load-bearing: 12 points is below the tier-2 threshold, so
--     tenure alone can never move anyone off rung 1. It is a tiebreaker, not a
--     merit signal.
--     NOT public.profiles.created_at, which was the obvious choice and is
--     wrong: probed on dev, a member updated their own profiles.created_at to
--     2016 inside a rolled-back transaction. The own-row UPDATE policy only
--     pins the id, and the column rides a blanket table-level grant, so the
--     mirror is member-writable. auth.users is not selectable OR updatable by
--     `authenticated` at all, and it is where the account actually started, so
--     it is both the safe source and the true one. See the note at the bottom
--     for the separate defect this leaves standing.
--
-- DELIBERATELY EXCLUDED: 'first_listing'. Publishing is exactly the "farmable by
-- posting" behaviour standing must be immune to. Also excluded, by construction:
-- every 'redeemed:%' debit (negative delta) and every 'refund:%' credit.
--
-- MONOTONICITY, stated so it can be checked: standing is
-- (non-negative weight x non-decreasing count) + (a capped clock). Ledger rows
-- are never deleted except by profile cascade, tenure only rises until the cap
-- and then stops, and no term is negative. Therefore standing never decreases.
--
-- NOTHING CHARGES A FEE FROM THIS YET. tier_fee_bps below is the already-ruled
-- ladder (5% / 3.5% / 3% / 2.5% / 2%) so there is one source of truth when the
-- fee work lands, but public.fee_bps() is still the flat global flag and
-- payments_enabled is still false. /rewards says so on the page.

-- ============================================================ THE CATALOGUE
-- Withdrawn: both visibility rewards charged points and did nothing. Nothing in
-- src/ reads public.post_boosts, so "promoted in the feed" was never true; and
-- redeem_reward's visibility branch can only target a row in public.posts, so
-- "Feature a listing" could not be applied to a listing even in principle.
--
-- Disabled rather than deleted: public.redemptions.reward_key is an FK to this
-- table and members have already spent points against these keys. Deleting the
-- rows would erase their receipts. The descriptions are rewritten because this
-- table is world-readable and a false promise sitting in a public row is still
-- a false promise.
update public.reward_catalog
   set enabled = false,
       description = 'Withdrawn. This never promoted anything, so it is no longer sold.'
 where key in ('boost_post', 'feature_listing');

-- The fee credit stops being hardcoded off and starts tracking the flag that
-- actually decides whether a fee exists to discount. When payments_enabled
-- flips, this becomes redeemable with no second deploy and no second decision.
update public.reward_catalog
   set enabled = true,
       description = 'Reduces the platform fee on your next completed sale. Redeemable once payments are switched on.'
 where key = 'fee_credit_10';

-- ====================================================== REVIEWS, BOTH SIDES
-- Two changes to one trigger.
--
-- 1. The award is keyed on the APPLICATION, not the review row. The old key was
--    ('review', new.id) and public.reviews has both DELETE and INSERT policies
--    for the author, so delete-and-rewrite minted a fresh id and the "same event
--    can never pay twice" index did not recognise it — 100 points, repeatable
--    indefinitely. reviews_one_per_application makes the application id the
--    stable identity of "this person reviewed this transaction".
--    Known consequence, stated rather than discovered: rows already written
--    under the old ('review', id) key do not collide with the new one, so an
--    existing reviewer can collect one final duplicate. Not backfilled — 51
--    rows on dev, none in production.
--
-- 2. The SUBJECT of the review earns too, which is what makes "reviews
--    received" countable from an append-only source. Same amount as the author
--    for the same stated reason handovers pay both sides: an honest transaction
--    is worth paying for on either side of it.
--    ponytail: two colluding accounts can still manufacture handovers and
--    reviews for each other. The bar Dailen set is "cannot be farmed by
--    posting", which this clears; sybil resistance is a different problem and
--    wants identity work, not a weight change here.
create or replace function public.points_on_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.award_points(new.reviewer_id, 100, 'review_written', 'application', new.application_id);
  perform public.award_points(new.subject_id, 100, 'review_received', 'application', new.application_id);
  return new;
end; $fn$;

-- ================================================================= STANDING
-- Internal. Revoked from every client role: the future fee ladder needs a
-- seller's standing while the buyer is the caller, so this one takes a target,
-- and my_standing() below is the only door a client gets.
--
-- WEIGHTS AND RUNGS, hardcoded on purpose. These are Dailen's ruling, not an
-- operator setting, so they live in the function rather than in platform_flags
-- — retuning them is a migration, which is the right amount of friction for a
-- number that decides what people pay.
--
--   completed handover   10   the strongest signal: a real two-party transaction
--   review received       5   tied to a handover, so it is never the only proof
--   month of tenure       1   capped at 12, which is below rung 2 on its own
--
--   rung 1  <25    5.00%      rung 4  >=150   2.50%
--   rung 2  >=25   3.50%      rung 5  >=350   2.00%
--   rung 3  >=60   3.00%
--
-- Counts ROWS, not the points those rows carry. Repricing 'handover_confirmed'
-- from 150 to 200 must not silently reshuffle everyone's fee.
create or replace function public.profile_standing(target_profile uuid)
returns table (
  handovers integer,
  reviews_received integer,
  tenure_months integer,
  standing_points integer,
  standing_tier integer,
  tier_fee_bps integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  with earned as (
    select
      count(*) filter (where reason = 'handover_confirmed')::integer as handovers,
      count(*) filter (where reason = 'review_received')::integer    as reviews_received
      from public.point_ledger
     -- delta > 0 is redundant next to the reason allowlist and kept anyway:
     -- it is the invariant, and a future earning rule must not be able to
     -- smuggle a debit into standing by reusing a reason.
     where profile_id = target_profile and delta > 0
  ),
  tenure as (
    select least(
      12,
      greatest(
        0,
        (extract(year from age(now(), u.created_at)) * 12
         + extract(month from age(now(), u.created_at)))::integer
      )
    )::integer as months
      from auth.users u
     where u.id = target_profile
  ),
  score as (
    select
      e.handovers,
      e.reviews_received,
      coalesce(t.months, 0)::integer as months,
      (e.handovers * 10 + e.reviews_received * 5 + coalesce(t.months, 0))::integer as points
      from earned e
      left join tenure t on true
  )
  select
    s.handovers,
    s.reviews_received,
    s.months,
    s.points,
    case when s.points >= 350 then 5
         when s.points >= 150 then 4
         when s.points >= 60  then 3
         when s.points >= 25  then 2
         else 1 end,
    case when s.points >= 350 then 200
         when s.points >= 150 then 250
         when s.points >= 60  then 300
         when s.points >= 25  then 350
         else 500 end
    from score s;
$fn$;
revoke execute on function public.profile_standing(uuid) from anon, authenticated, public;

-- The client-facing door. No argument, so one member can never ask for
-- another's rung.
create or replace function public.my_standing()
returns table (
  handovers integer,
  reviews_received integer,
  tenure_months integer,
  standing_points integer,
  standing_tier integer,
  tier_fee_bps integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select * from public.profile_standing(auth.uid()) where auth.uid() is not null;
$fn$;
revoke execute on function public.my_standing() from anon, public;
grant execute on function public.my_standing() to authenticated;

-- ================================================ A LEAK FOUND WHILE HERE
--    points_balance() is SECURITY DEFINER, takes any profile id, and was
--    granted to authenticated with no check on who asked. point_ledger's RLS
--    says own-rows-only and rewards-services.spec.ts asserts it, but the
--    definer walked straight past both: signed in as the member fixture,
--    points_balance('…0001') returned the seller's 7200. Returns null rather
--    than raising for a foreign id, matching admin_redemption_notes() — a
--    caller that forgets to check renders nothing instead of leaking through an
--    error message. redeem_reward passes auth.uid(), so it is unaffected.
create or replace function public.points_balance(target_profile uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select case when target_profile = auth.uid() then
    coalesce((select sum(delta) from public.point_ledger where profile_id = target_profile), 0)::integer
  end;
$fn$;
revoke execute on function public.points_balance(uuid) from anon, public;
grant execute on function public.points_balance(uuid) to authenticated;

-- ========================= NOT FIXED HERE: profiles.created_at IS WRITABLE
-- Reported rather than patched, with the evidence, because the correct fix is
-- bigger than this lane and standing no longer depends on it.
--
-- public.profiles carries the blanket table-level grant (relacl `arwdDxtm` to
-- both anon and authenticated) and the own-row UPDATE policy's WITH CHECK pins
-- only the id, so a member can rewrite any column of their own row — including
-- created_at, which /u/<username> renders as "joined". Probed: the member
-- fixture set itself to 2016 and read it back, inside a rolled-back
-- transaction.
--
-- `revoke update (created_at) on public.profiles` was tried FIRST and is not
-- what shipped, because it silently does nothing: a column-level revoke cannot
-- subtract from a table-level grant. That is the same trap 20260730200412
-- already documented for SELECT, and information_schema.column_privileges
-- still reported the grant afterwards while the probe still backdated. A
-- migration reporting success proves nothing.
--
-- The real remedy is that migration's shape — `revoke update on public.profiles
-- from anon, authenticated` followed by a column allowlist grant — and it needs
-- an audit of every writer across the app (profiles, tree, messaging,
-- onboarding, brands, admin, account) to enumerate the allowlist. That belongs
-- to whoever owns profiles, not to rewards.

-- ============================================================== REDEMPTION
-- Unchanged except for one gate: a fee credit is a discount on a fee, and there
-- is no fee while payments are off, so redeeming one would burn real points for
-- a credit against nothing. Gated on the flag rather than on the enabled column
-- so operators flip payments once and this follows.
--
-- The debit written at the bottom is a negative delta with reason
-- 'redeemed:<key>'. profile_standing() counts neither. Spending cannot demote.
create or replace function public.redeem_reward(
  reward text, target_post uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  r record;
  rid uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into r from public.reward_catalog where key = reward;
  if r is null then raise exception 'unknown_reward'; end if;
  if not r.enabled then raise exception 'reward_not_available'; end if;
  if r.kind = 'fee_credit' and not public.is_flag_enabled('payments_enabled') then
    raise exception 'payments_disabled';
  end if;
  if public.points_balance(uid) < r.cost_points then raise exception 'insufficient_points'; end if;

  if r.kind = 'visibility' then
    if target_post is null then raise exception 'target_post_required'; end if;
    if not exists (
      select 1 from public.posts
       where id = target_post and author_id = uid and deleted_at is null
    ) then raise exception 'not_your_post'; end if;
  end if;

  insert into public.redemptions (profile_id, reward_key, points_spent, target_post_id, status)
  values (uid, reward, r.cost_points, target_post,
          case when r.kind = 'visibility' then 'fulfilled' else 'requested' end)
  returning id into rid;

  insert into public.point_ledger (profile_id, delta, reason, ref_type, ref_id)
  values (uid, -r.cost_points, 'redeemed:' || reward, 'redemption', rid);

  -- Visibility rewards apply immediately; goods need a human to ship them.
  if r.kind = 'visibility' then
    insert into public.post_boosts (post_id, boosted_until, redemption_id)
    values (target_post,
            now() + case when reward = 'feature_listing' then interval '7 days'
                         else interval '48 hours' end,
            rid)
    on conflict (post_id) do update
      set boosted_until = greatest(public.post_boosts.boosted_until, excluded.boosted_until),
          redemption_id = excluded.redemption_id;
  end if;

  return rid;
end; $fn$;
revoke execute on function public.redeem_reward(text, uuid) from anon, public;
grant execute on function public.redeem_reward(text, uuid) to authenticated;
