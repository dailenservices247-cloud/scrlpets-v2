-- Rewards: a cold-start engine, not a loyalty programme.
--
-- Every earning rule is a marketplace-liquidity behaviour — list something,
-- complete a handover, review the person you dealt with. Redemptions buy
-- distribution, which is what a seller actually wants before there are enough
-- buyers. Dailen's legacy design had this shape and it was the right one.
--
-- FOUR THINGS FROM LEGACY DELIBERATELY DO NOT RETURN:
--   * Cash out. Points that convert to money are stored value, which drags in
--     money-transmitter and unclaimed-property exposure. Nothing here converts.
--   * Fee payer flipping by subscription tier.
--   * An uncapped percentage rebate.
--   * Paid ranking that a buyer cannot distinguish from earned standing.
--     Boosts exist, but every boosted post is labelled, and boosting never
--     touches verification or review signals.

-- ===================================================== EARNING (server-only)
-- Append-only. No client write policy, no update, no delete: a balance is the
-- sum of an immutable history, so it cannot be edited into existence.
create table if not exists public.point_ledger (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz default now() not null,
  constraint point_ledger_pkey primary key (id),
  constraint point_ledger_delta_nonzero check (delta <> 0)
);
-- The same event can never pay twice.
create unique index if not exists idx_point_ledger_once
  on public.point_ledger (profile_id, reason, ref_type, ref_id)
  where ref_id is not null;
create index if not exists idx_point_ledger_profile
  on public.point_ledger (profile_id, created_at desc);

alter table public.point_ledger enable row level security;
create policy "own read point ledger" on public.point_ledger
for select to authenticated using (profile_id = (select auth.uid()));

create or replace function public.points_balance(target_profile uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(delta), 0)::integer
    from public.point_ledger where profile_id = target_profile;
$fn$;
revoke execute on function public.points_balance(uuid) from anon, public;
grant execute on function public.points_balance(uuid) to authenticated;

-- Internal only. Never granted to any client role — points are awarded by the
-- database in response to real events, never requested.
create or replace function public.award_points(
  target_profile uuid, amount integer, why text, rtype text, rid uuid
)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if target_profile is null or amount = 0 then return; end if;
  insert into public.point_ledger (profile_id, delta, reason, ref_type, ref_id)
  values (target_profile, amount, why, rtype, rid)
  on conflict do nothing;
end; $fn$;
revoke execute on function public.award_points(uuid, integer, text, text, uuid) from anon, authenticated, public;

-- Rule 1: publishing your first listing. Paid once, ever.
create or replace function public.points_on_first_listing()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (
    select 1 from public.listings
     where seller_id = new.seller_id and id <> new.id and deleted_at is null
  ) then
    perform public.award_points(new.seller_id, 200, 'first_listing', 'listing', new.id);
  end if;
  return new;
end; $fn$;
create trigger points_first_listing
after insert on public.listings
for each row execute function public.points_on_first_listing();

-- Rule 2: a handover both parties confirmed. Both sides earn — completing a
-- transaction honestly is the behaviour worth paying for, on either side.
create or replace function public.points_on_handover()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null then
    perform public.award_points(new.buyer_id, 150, 'handover_confirmed', 'application', new.id);
    perform public.award_points(new.seller_id, 150, 'handover_confirmed', 'application', new.id);
  end if;
  return new;
end; $fn$;
create trigger points_handover
after update on public.buyer_applications
for each row execute function public.points_on_handover();

-- Rule 3: writing a review of a completed handover.
create or replace function public.points_on_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.award_points(new.reviewer_id, 100, 'review_written', 'review', new.id);
  return new;
end; $fn$;
create trigger points_review
after insert on public.reviews
for each row execute function public.points_on_review();

-- ================================================================ CATALOG
create table if not exists public.reward_catalog (
  key text not null,
  title text not null,
  description text,
  cost_points integer not null,
  kind text not null,
  enabled boolean not null default true,
  constraint reward_catalog_pkey primary key (key),
  constraint reward_catalog_cost_positive check (cost_points > 0),
  -- No 'cash' kind exists. Adding one is a legal decision, not a code change.
  constraint reward_catalog_kind_check check (kind = any (array['visibility','goods','fee_credit']))
);
alter table public.reward_catalog enable row level security;
create policy "public read reward catalog" on public.reward_catalog
for select to anon, authenticated using (true);

insert into public.reward_catalog (key, title, description, cost_points, kind, enabled) values
  ('boost_post', 'Boost a post', 'Your post is promoted in the feed for 48 hours, labelled as promoted.', 250, 'visibility', true),
  ('feature_listing', 'Feature a listing', 'Your listing is promoted in the feed for 7 days, labelled as promoted.', 500, 'visibility', true),
  ('swag_pack', 'Scrlpets swag pack', 'Physical goods, shipped after review.', 1000, 'goods', true),
  -- Built and OFF: whether a non-transferable discount on your own future fee
  -- counts as stored value is a question for A3, not an assumption to ship.
  ('fee_credit_10', '$10 off your next platform fee', 'Reduces the fee on your next completed sale.', 750, 'fee_credit', false)
on conflict (key) do nothing;

-- ============================================================ REDEMPTIONS
create table if not exists public.redemptions (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_key text not null references public.reward_catalog(key),
  points_spent integer not null,
  status text not null default 'requested',
  target_post_id uuid references public.posts(id) on delete set null,
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  constraint redemptions_pkey primary key (id),
  constraint redemptions_status_check check (
    status = any (array['requested','approved','rejected','fulfilled'])
  )
);
create index if not exists idx_redemptions_profile on public.redemptions (profile_id, created_at desc);
alter table public.redemptions enable row level security;
create policy "own read redemptions" on public.redemptions
for select to authenticated using (profile_id = (select auth.uid()));
create policy "admins read redemptions" on public.redemptions
for select to authenticated using (public.is_platform_admin());

-- Boosted content. Public so the feed can render the label; written only by
-- the redeem definer.
create table if not exists public.post_boosts (
  post_id uuid not null references public.posts(id) on delete cascade,
  boosted_until timestamptz not null,
  redemption_id uuid references public.redemptions(id) on delete set null,
  constraint post_boosts_pkey primary key (post_id)
);
alter table public.post_boosts enable row level security;
create policy "public read boosts" on public.post_boosts
for select to anon, authenticated using (true);

-- The only way to spend points. Checks the balance, refuses disabled rewards,
-- and writes the debit and the redemption in one transaction so a balance can
-- never go negative or a redemption exist unpaid.
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

-- Admin decision on a goods redemption. Rejecting refunds the points, so a
-- member is never charged for something that was not sent.
create or replace function public.review_redemption(
  target_redemption uuid, decision text, notes text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  r record;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if decision not in ('approved','rejected','fulfilled') then raise exception 'invalid_decision'; end if;
  select * into r from public.redemptions where id = target_redemption;
  if r is null then raise exception 'not_found'; end if;
  if r.status in ('rejected','fulfilled') then raise exception 'already_resolved'; end if;

  if decision = 'rejected' then
    insert into public.point_ledger (profile_id, delta, reason, ref_type, ref_id)
    values (r.profile_id, r.points_spent, 'refund:' || r.reward_key, 'redemption_refund', r.id)
    on conflict do nothing;
  end if;

  update public.redemptions
     set status = decision, reviewed_by = uid, reviewed_at = now(), admin_notes = notes
   where id = target_redemption;
end; $fn$;
revoke execute on function public.review_redemption(uuid, text, text) from anon, public;
grant execute on function public.review_redemption(uuid, text, text) to authenticated;
