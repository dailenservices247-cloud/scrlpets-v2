-- The last hole in the engine: settle_order computes every §1–§4 split exactly
-- and sends the buyer nothing.
--
-- A wrong-animal ruling today records that the buyer is owed $2,000 and pays
-- them $0. That is worse than having no branches at all, because the order says
-- "refunded" while the money sat still — the record lies.
--
-- Same split as payouts: the database owns WHAT is owed back and against WHICH
-- charge; a runner owns the Stripe call. Amounts are never supplied by the
-- caller.
--
-- REVERSALS COME FIRST. A payout may already have gone out before a dispute
-- landed — an inspection window that elapsed, then a §4 claim inside the
-- guarantee period. Refunding the buyer without clawing that back would pay the
-- same money twice, so a refund is blocked while any transfer on the order is
-- still unreversed.

create table if not exists public.order_refunds (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_cents integer not null,
  stripe_refund_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint order_refunds_pkey primary key (id),
  constraint order_refunds_amount_positive check (amount_cents > 0),
  constraint order_refunds_status_check check (status = any (array['pending','paid','failed'])),
  constraint order_refunds_paid_needs_id check (status <> 'paid' or stripe_refund_id is not null)
);

create unique index if not exists idx_order_refunds_stripe
  on public.order_refunds (stripe_refund_id) where stripe_refund_id is not null;
-- One refund obligation per order. A second settlement must not create a second
-- debt to the same buyer for the same sale.
create unique index if not exists idx_order_refunds_one_per_order
  on public.order_refunds (order_id);

alter table public.order_refunds enable row level security;
create policy "parties read order refunds" on public.order_refunds
for select to authenticated
using (exists (select 1 from public.orders o
                where o.id = order_refunds.order_id
                  and (select auth.uid()) in (o.buyer_id, o.seller_id)));

/**
 * Settling an order that owes the buyer money creates the refund obligation.
 *
 * A trigger, so every settlement branch is covered and a future branch cannot
 * forget. The amount is `order_buyer_refund_cents` — the ruled split plus the
 * portion of the buyer's own fee the platform did not keep.
 */
create or replace function public.refund_on_order_settled()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare owed integer;
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    owed := public.order_buyer_refund_cents(new.id);
    if owed > 0 then
      insert into public.order_refunds (order_id, amount_cents)
      values (new.id, owed)
      on conflict (order_id) do nothing;
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists trg_refund_on_order_settled on public.orders;
create trigger trg_refund_on_order_settled
after update of status on public.orders
for each row execute function public.refund_on_order_settled();

/**
 * Refunds ready to send, with the charge to refund against.
 *
 * Blocked while any transfer on the order is still unreversed — see the header.
 * Paying a buyer back money already sent to a seller pays it twice.
 *
 * Refunds against the LARGEST captured payment on the order. Stripe refunds a
 * specific PaymentIntent, and a deposit-then-balance order has two; refunding
 * the larger one covers the common case, and a refund exceeding it is surfaced
 * as `needs_manual_split` rather than silently short-paying the buyer.
 */
create or replace function public.pending_refunds()
returns table (
  refund_id uuid,
  order_id uuid,
  amount_cents integer,
  payment_intent_id text,
  captured_on_that_intent integer,
  needs_manual_split boolean,
  unreversed_transfers integer
)
language sql stable security definer set search_path = public as $fn$
  with biggest as (
    select distinct on (p.order_id)
           p.order_id, p.stripe_payment_intent_id, p.amount_cents
      from public.order_payments p
     where p.status = 'captured'
     order by p.order_id, p.amount_cents desc
  )
  select r.id, r.order_id, r.amount_cents,
         b.stripe_payment_intent_id, b.amount_cents,
         r.amount_cents > b.amount_cents,
         (select count(*)::integer from public.order_payouts po
           where po.order_id = r.order_id and po.status = 'paid')
    from public.order_refunds r
    join biggest b on b.order_id = r.order_id
   where r.status = 'pending'
     and r.stripe_refund_id is null
     and not exists (
       select 1 from public.order_payouts po
        where po.order_id = r.order_id and po.status = 'paid'
     )
   order by r.created_at asc;
$fn$;
revoke execute on function public.pending_refunds() from anon, authenticated, public;

create or replace function public.mark_refund_paid(target_refund uuid, refund_id text)
returns void language plpgsql security definer set search_path = public as $fn$
declare existing uuid;
begin
  if refund_id is null or btrim(refund_id) = '' then raise exception 'refund_id_required'; end if;
  select id into existing from public.order_refunds where stripe_refund_id = btrim(refund_id);
  if existing is not null then return; end if;

  update public.order_refunds set
    stripe_refund_id = btrim(refund_id), status = 'paid', paid_at = now()
  where id = target_refund and status = 'pending';
end; $fn$;
revoke execute on function public.mark_refund_paid(uuid, text) from anon, authenticated, public;
