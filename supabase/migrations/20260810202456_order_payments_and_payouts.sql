-- Step 2: one order, many payments; one order, many payouts.
--
-- `orders.stripe_payment_intent_id` and `orders.stripe_transfer_id` are single
-- columns, so an order could hold exactly one payment and exactly one payout.
-- That makes two ruled behaviours impossible to express:
--
--   * DEPOSIT NOW, BALANCE LATER — two charges against one order.
--   * THE TRANSPORTER IS PAID IN EVERY BRANCH — a second payout leg to a party
--     who is neither the buyer nor the seller.
--
-- Both columns stay for now (nothing reads them; step 4 removes them) so this
-- migration adds capability without breaking a rollback.
--
-- A new status comes with it. A deposit that is held while the balance is
-- unpaid is a REAL state the dispute policy depends on — §1 forfeits the deposit
-- to the seller when the buyer walks with no cause, and that can happen long
-- before the balance is due. Without `deposit_held` that money would be sitting
-- in an order still labelled `awaiting_payment`, i.e. indistinguishable from an
-- order where nothing has been paid at all.
--
-- Note what did NOT need changing: `mark_dispatched` requires `funds_held`, and
-- `funds_held` now means FULLY captured. So "a seller cannot hand over an animal
-- against a deposit alone" is already enforced by the existing gate rather than
-- by a new rule.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status = any (array[
    'draft','awaiting_payment','deposit_held','funds_held','dispatched',
    'inspection','released','refunded','cancelled','disputed'
  ])
);

-- ============================================================ PAYMENTS IN
create table if not exists public.order_payments (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,
  amount_cents integer not null,
  stripe_payment_intent_id text,
  status text not null default 'pending',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_payments_pkey primary key (id),
  constraint order_payments_kind_check check (kind = any (array['deposit','balance','full'])),
  constraint order_payments_status_check check (status = any (array['pending','captured','refunded','failed'])),
  constraint order_payments_amount_positive check (amount_cents > 0),
  -- A captured payment without an intent id is a payment that cannot be
  -- reconciled against Stripe, refunded, or defended in a chargeback.
  constraint order_payments_captured_needs_intent
    check (status <> 'captured' or stripe_payment_intent_id is not null)
);

-- Stripe delivers webhooks at least once. Without this, a redelivered
-- payment_intent.succeeded books the same money twice and the order looks
-- overpaid.
create unique index if not exists idx_order_payments_intent
  on public.order_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists idx_order_payments_order on public.order_payments (order_id);

alter table public.order_payments enable row level security;
create policy "parties read order payments" on public.order_payments
for select to authenticated
using (exists (
  select 1 from public.orders o
   where o.id = order_payments.order_id
     and ((select auth.uid()) in (o.buyer_id, o.seller_id))
));

-- ============================================================ PAYOUTS OUT
create table if not exists public.order_payouts (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  leg text not null,
  amount_cents integer not null,
  stripe_transfer_id text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_payouts_pkey primary key (id),
  constraint order_payouts_leg_check check (leg = any (array['seller','transporter'])),
  constraint order_payouts_status_check check (status = any (array['pending','paid','reversed'])),
  constraint order_payouts_amount_positive check (amount_cents > 0),
  constraint order_payouts_paid_needs_transfer
    check (status <> 'paid' or stripe_transfer_id is not null)
);

create unique index if not exists idx_order_payouts_transfer
  on public.order_payouts (stripe_transfer_id)
  where stripe_transfer_id is not null;
create index if not exists idx_order_payouts_order on public.order_payouts (order_id);
create index if not exists idx_order_payouts_recipient on public.order_payouts (recipient_id, created_at desc);

alter table public.order_payouts enable row level security;
-- The RECIPIENT is included deliberately: a transporter is neither the buyer nor
-- the seller, and a party who cannot see that they are owed money cannot chase
-- it. They see their own leg only, not the buyer's or the seller's.
create policy "parties and recipient read order payouts" on public.order_payouts
for select to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.orders o
     where o.id = order_payouts.order_id
       and ((select auth.uid()) in (o.buyer_id, o.seller_id))
  )
);

-- ============================================================ DERIVED SUMS
/**
 * What the buyer owes in total. DERIVED, never stored — a stored total drifts
 * from its parts the moment one of them changes, and this number decides when
 * funds are considered held.
 *
 * `deposit_cents` is a PORTION of `amount_cents` (see the constraint
 * deposit_cents <= amount_cents), not an addition, so it must not be summed
 * here. Adding it would double-charge every deposit order.
 *
 * ponytail: buyer-side fees land in step 4 and are added here, not anywhere else.
 */
create or replace function public.order_due_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select o.amount_cents + o.transport_cents
    from public.orders o where o.id = target_order;
$fn$;
revoke execute on function public.order_due_cents(uuid) from anon, public;
grant execute on function public.order_due_cents(uuid) to authenticated;

create or replace function public.order_captured_cents(target_order uuid)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(p.amount_cents), 0)::integer
    from public.order_payments p
   where p.order_id = target_order and p.status = 'captured';
$fn$;
revoke execute on function public.order_captured_cents(uuid) from anon, public;
grant execute on function public.order_captured_cents(uuid) to authenticated;

-- ============================================================ THE WRITER
/**
 * The only way a payment is booked. Service-role only — called by the Stripe
 * webhook after Stripe confirms the capture. A buyer cannot assert their own
 * payment, which is the same rule `mark_funds_held` established and the reason
 * that function is superseded rather than kept alongside this one.
 *
 * The status transition is DERIVED from money actually captured against money
 * actually owed, not passed in:
 *
 *   captured >= due   -> funds_held   (and the handover code is minted)
 *   captured > 0      -> deposit_held
 *
 * Minting the code at full capture rather than at first payment is deliberate:
 * the code releases the whole balance, and it should not exist while only a
 * deposit is down.
 */
create or replace function public.record_order_payment(
  target_order uuid,
  payment_kind text,
  amount integer,
  payment_intent_id text
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  o record;
  captured integer;
  due integer;
  pid uuid;
begin
  if payment_intent_id is null or btrim(payment_intent_id) = '' then
    raise exception 'payment_intent_required';
  end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.status in ('released','refunded','cancelled') then raise exception 'order_closed'; end if;

  -- Redelivered webhook: the unique index would raise, but a raise here means a
  -- retrying webhook never converges. Return the existing row instead.
  select id into pid from public.order_payments
   where stripe_payment_intent_id = payment_intent_id;
  if pid is not null then return pid; end if;

  insert into public.order_payments
    (order_id, kind, amount_cents, stripe_payment_intent_id, status, captured_at)
  values (target_order, payment_kind, amount, payment_intent_id, 'captured', now())
  returning id into pid;

  captured := public.order_captured_cents(target_order);
  due := public.order_due_cents(target_order);

  if captured >= due then
    update public.orders set
      status = 'funds_held',
      handover_code = coalesce(handover_code, (
        select string_agg(substr('ACDEFHJKLMNPRTUVWXY34679', 1 + floor(random() * 24)::int, 1), '')
          from generate_series(1, 6)
      )),
      updated_at = now()
    where id = target_order;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (target_order, null, o.status, 'funds_held', 'fully captured');
  elsif o.status <> 'deposit_held' then
    update public.orders set status = 'deposit_held', updated_at = now() where id = target_order;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (target_order, null, o.status, 'deposit_held', 'deposit captured');
  end if;

  return pid;
end; $fn$;
revoke execute on function public.record_order_payment(uuid, text, integer, text)
  from anon, authenticated, public;

/**
 * A payout leg. Service-role only, same reasoning. Recorded `pending` when the
 * obligation is created and flipped to `paid` when Stripe confirms the transfer,
 * so a leg that was owed but never sent is VISIBLE rather than absent — which is
 * exactly how legacy's release path hid the fact that it never paid anyone.
 */
create or replace function public.record_order_payout(
  target_order uuid,
  recipient uuid,
  payout_leg text,
  amount integer,
  transfer_id text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare pid uuid;
begin
  if transfer_id is not null then
    select id into pid from public.order_payouts where stripe_transfer_id = transfer_id;
    if pid is not null then return pid; end if;
  end if;

  insert into public.order_payouts
    (order_id, recipient_id, leg, amount_cents, stripe_transfer_id, status, paid_at)
  values (target_order, recipient, payout_leg, amount, transfer_id,
          case when transfer_id is null then 'pending' else 'paid' end,
          case when transfer_id is null then null else now() end)
  returning id into pid;
  return pid;
end; $fn$;
revoke execute on function public.record_order_payout(uuid, uuid, text, integer, text)
  from anon, authenticated, public;

-- `mark_funds_held` is superseded: it booked a status without booking the money.
drop function if exists public.mark_funds_held(uuid, text);

-- A deposit can be forfeited or refunded, so a dispute must be raisable against
-- an order holding only a deposit.
create or replace function public.dispute_order(target_order uuid, reason text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if reason is null or btrim(reason) = '' then raise exception 'reason_required'; end if;

  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if uid <> o.buyer_id and uid <> o.seller_id then raise exception 'not_a_party'; end if;
  if o.status not in ('deposit_held', 'funds_held', 'dispatched', 'inspection') then
    raise exception 'nothing_held';
  end if;

  update public.orders set status = 'disputed', updated_at = now() where id = target_order;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'disputed', reason);
end; $fn$;
revoke execute on function public.dispute_order(uuid, text) from anon, public;
grant execute on function public.dispute_order(uuid, text) to authenticated;
