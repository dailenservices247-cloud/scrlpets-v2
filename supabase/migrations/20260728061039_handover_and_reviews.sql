-- Verified reviews, tied to a confirmed handover rather than a paid order.
--
-- Legacy had `breeder_reviews` with a `verified_purchase` BOOLEAN — a flag
-- something had to remember to set, and therefore a flag that could be wrong.
-- Here a review cannot exist without a handover both parties confirmed, so
-- "verified" is structural instead of asserted. There is no unverified review
-- to distinguish it from.
--
-- Deliberately NOT waiting for payments: an accepted application that both
-- sides confirm is already a real transaction. Waiting for A3 would leave the
-- trust surface empty for months.

alter table public.buyer_applications
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists seller_confirmed_at timestamptz;

-- Each party confirms only their own side, and only on an accepted
-- application. Neither can confirm on the other's behalf.
create or replace function public.confirm_handover(target_application uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  a record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into a from public.buyer_applications where id = target_application;
  if a is null then raise exception 'not_found'; end if;
  if a.status <> 'accepted' then raise exception 'application_not_accepted'; end if;

  if uid = a.buyer_id then
    update public.buyer_applications
       set buyer_confirmed_at = coalesce(buyer_confirmed_at, now())
     where id = target_application;
  elsif uid = a.seller_id then
    update public.buyer_applications
       set seller_confirmed_at = coalesce(seller_confirmed_at, now())
     where id = target_application;
  else
    raise exception 'not_a_party';
  end if;
end; $fn$;
revoke execute on function public.confirm_handover(uuid) from anon, public;
grant execute on function public.confirm_handover(uuid) to authenticated;

create or replace function public.is_handover_complete(target_application uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.buyer_applications
    where id = target_application
      and status = 'accepted'
      and buyer_confirmed_at is not null
      and seller_confirmed_at is not null
  );
$fn$;

create table if not exists public.reviews (
  id uuid default gen_random_uuid() not null,
  application_id uuid not null references public.buyer_applications(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  accuracy_rating integer,
  communication_rating integer,
  health_rating integer,
  title text,
  body text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint reviews_pkey primary key (id),
  -- One review per transaction. Not per pair of people — a repeat buyer
  -- reviews each handover separately, which is the honest unit.
  constraint reviews_one_per_application unique (application_id),
  constraint reviews_not_self check (reviewer_id <> subject_id),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_accuracy_range check (accuracy_rating is null or accuracy_rating between 1 and 5),
  constraint reviews_communication_range check (communication_rating is null or communication_rating between 1 and 5),
  constraint reviews_health_range check (health_rating is null or health_rating between 1 and 5)
);
create index if not exists idx_reviews_subject on public.reviews (subject_id, created_at desc);

alter table public.reviews enable row level security;

create policy "public read reviews" on public.reviews
for select to anon, authenticated using (true);

-- The buyer of a CONFIRMED handover may review the seller. Every clause here
-- is load-bearing: without the handover check a review is just an opinion
-- from a stranger, which is what the legacy boolean allowed.
create policy "buyer reviews a confirmed handover" on public.reviews
for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and not public.is_suspended((select auth.uid()))
  and public.is_handover_complete(application_id)
  and exists (
    select 1 from public.buyer_applications a
    where a.id = reviews.application_id
      and a.buyer_id = (select auth.uid())
      and a.seller_id = reviews.subject_id
  )
);

-- The author may correct their own review. No delete policy: a seller must
-- not be able to make criticism disappear, and neither should the author
-- silently erase a record the other party relied on.
create policy "author updates own review" on public.reviews
for update to authenticated
using (reviewer_id = (select auth.uid()))
with check (reviewer_id = (select auth.uid()));

create or replace function public.touch_review_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  -- The subject and the transaction are fixed at creation; an edit may change
  -- the words and the scores, never who it is about.
  new.application_id := old.application_id;
  new.reviewer_id := old.reviewer_id;
  new.subject_id := old.subject_id;
  return new;
end; $fn$;

create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_review_updated_at();
