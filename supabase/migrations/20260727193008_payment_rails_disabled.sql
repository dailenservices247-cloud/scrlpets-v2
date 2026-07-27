-- Phase 4b — escrow/payment rails (D10). Built, tested, and OFF.
--
-- The switch is a DB row, not a UI condition: every money path raises
-- 'payments_disabled' until the flag flips, so a leaked client or a bypassed
-- server action still cannot move money. A3 (legal review) is the real gate.

create table if not exists public.platform_flags (
  key text not null,
  enabled boolean not null default false,
  updated_at timestamptz default now() not null,
  constraint platform_flags_pkey primary key (key)
);
alter table public.platform_flags enable row level security;
-- Readable so the UI can say honestly that payments are off. No write policy:
-- flipping the switch is a deliberate admin/DB action, never a client call.
create policy "read platform flags" on public.platform_flags
for select to anon, authenticated using (true);

insert into public.platform_flags (key, enabled) values ('payments_enabled', false)
on conflict (key) do nothing;

create or replace function public.is_flag_enabled(flag_key text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select enabled from public.platform_flags where key = flag_key), false);
$fn$;

-- ================================================================== ORDERS
-- Legacy `transactions` carried fee_payer + seller_tier. The intent (the
-- platform takes a fee, someone pays it) is preserved as columns; the MODEL
-- was never re-decided, so create_order writes fee_cents = 0 and nothing
-- computes a tier. Do not invent one here.
create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid references public.listings(id) on delete set null,
  title_snapshot text,
  amount_cents integer not null,
  currency text not null default 'usd',
  fee_cents integer not null default 0,
  fee_payer text,
  status text not null default 'draft',
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint orders_pkey primary key (id),
  constraint orders_amount_positive check (amount_cents > 0),
  constraint orders_not_self check (buyer_id <> seller_id),
  constraint orders_status_check check (
    status = any (array['draft','awaiting_payment','funds_held','released','refunded','cancelled'])
  ),
  constraint orders_fee_payer_check check (fee_payer is null or fee_payer = any (array['buyer','seller']))
);
create index if not exists idx_orders_parties on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_seller on public.orders (seller_id, created_at desc);

alter table public.orders enable row level security;
-- Parties read their own orders. NO client insert/update/delete policy at all.
create policy "read own orders" on public.orders
for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- Append-only audit of every state change, same shape as moderation_actions.
create table if not exists public.order_events (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz default now() not null,
  constraint order_events_pkey primary key (id)
);
alter table public.order_events enable row level security;
create policy "parties read order events" on public.order_events
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_events.order_id
    and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
));

create or replace function public.create_order(target_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  oid uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into l from public.listings where id = target_listing and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.seller_id = uid then raise exception 'cannot_buy_own_listing'; end if;
  if l.availability <> 'available' then raise exception 'listing_unavailable'; end if;

  -- The Phase 2 gate applies to money exactly as it applies to publication.
  if l.creature_id is not null then
    if not public.is_verified_seller(l.seller_id) then raise exception 'seller_not_verified'; end if;
    if not public.is_animal_listable(l.creature_id) then raise exception 'animal_not_listable'; end if;
  end if;

  insert into public.orders (buyer_id, seller_id, listing_id, title_snapshot, amount_cents, currency, fee_cents)
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency, 0)
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft', 'order created');
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid) from anon, public;
grant execute on function public.create_order(uuid) to authenticated;

create or replace function public.advance_order(
  target_order uuid, new_status text, note text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  allowed boolean := false;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;

  -- Escrow moves forward one step at a time, and only the party who can
  -- actually cause that step may request it.
  allowed := case
    when o.status = 'draft'            and new_status = 'awaiting_payment' and uid = o.buyer_id  then true
    when o.status = 'awaiting_payment' and new_status = 'funds_held'       and uid = o.buyer_id  then true
    when o.status = 'funds_held'       and new_status = 'released'         and uid = o.buyer_id  then true
    when o.status = 'funds_held'       and new_status = 'refunded'         and uid = o.seller_id then true
    when o.status in ('draft','awaiting_payment') and new_status = 'cancelled'                   then true
    else false
  end;
  if not allowed then raise exception 'invalid_transition'; end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, new_status, note);
  update public.orders set status = new_status, updated_at = now() where id = target_order;
end; $fn$;
revoke execute on function public.advance_order(uuid, text, text) from anon, public;
grant execute on function public.advance_order(uuid, text, text) to authenticated;
