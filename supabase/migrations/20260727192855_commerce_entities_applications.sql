-- Phase 4a — product entities (D9) + buyer applications & waitlists (D13).
--
-- Deliberately NO separate products table. A product is a listing with no
-- creature_id, which is exactly what the Phase 2 gate already understands. A
-- parallel table would need its own copy of the gate, and a missed copy is an
-- animal-listing bypass.

alter table public.listings
  add column if not exists description text,
  add column if not exists currency text not null default 'usd',
  add column if not exists category text,
  add column if not exists availability text not null default 'available';

do $$ begin
  alter table public.listings add constraint listings_availability_check
    check (availability = any (array['available','pending','sold']));
exception when duplicate_object then null; end $$;

-- The shop browses non-animal listings; animals stay on their own surfaces.
create index if not exists idx_listings_shop
  on public.listings using btree (created_at desc)
  where creature_id is null and deleted_at is null;

-- ======================================= BUYER APPLICATIONS + WAITLISTS (D13)
-- One object, not two. An application against a listing is an application; the
-- same row with listing_id null is a waitlist entry for that seller.
create table if not exists public.buyer_applications (
  id uuid default gen_random_uuid() not null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  message text,
  status text not null default 'submitted',
  created_at timestamptz default now() not null,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  constraint buyer_applications_pkey primary key (id),
  constraint buyer_applications_status_check check (
    status = any (array['submitted','accepted','declined','withdrawn'])
  ),
  constraint buyer_applications_not_self check (buyer_id <> seller_id)
);
create unique index if not exists idx_one_open_application
  on public.buyer_applications (buyer_id, listing_id)
  where status = 'submitted' and listing_id is not null;
create unique index if not exists idx_one_open_waitlist
  on public.buyer_applications (buyer_id, seller_id)
  where status = 'submitted' and listing_id is null;
create index if not exists idx_applications_seller
  on public.buyer_applications (seller_id, status, created_at desc);

alter table public.buyer_applications enable row level security;

-- Both sides read their own rows; nobody else sees them.
create policy "read own applications" on public.buyer_applications
for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- A buyer applies as themselves, cannot apply while suspended, and cannot
-- apply to somebody who has blocked them (or whom they have blocked).
create policy "buyer submits application" on public.buyer_applications
for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and status = 'submitted'
  and decided_at is null
  and decided_by is null
  and not public.is_suspended((select auth.uid()))
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = buyer_applications.seller_id and b.blocked_id = (select auth.uid()))
       or (b.blocker_id = (select auth.uid()) and b.blocked_id = buyer_applications.seller_id)
  )
);

-- NO client UPDATE policy. Withdrawal and decisions both go through the
-- definer below, so a buyer can never write themselves an 'accepted'.
create or replace function public.set_application_status(
  target_application uuid, new_status text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a record;
begin
  select * into a from public.buyer_applications where id = target_application;
  if a is null then raise exception 'not_found'; end if;
  if a.status <> 'submitted' then raise exception 'already_decided'; end if;

  if uid = a.buyer_id then
    if new_status <> 'withdrawn' then raise exception 'buyer_may_only_withdraw'; end if;
  elsif uid = a.seller_id then
    if new_status not in ('accepted','declined') then raise exception 'invalid_decision'; end if;
  else
    raise exception 'not_a_party';
  end if;

  update public.buyer_applications
     set status = new_status, decided_at = now(), decided_by = uid
   where id = target_application;
end; $$;
revoke execute on function public.set_application_status(uuid, text) from anon, public;
grant execute on function public.set_application_status(uuid, text) to authenticated;
