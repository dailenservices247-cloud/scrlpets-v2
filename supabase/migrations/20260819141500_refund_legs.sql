-- A refund could not span two charges, so it was not paid at all.
--
-- `settle_order` computes what the buyer is owed exactly. A deposit-then-balance
-- order pays it across TWO PaymentIntents, and Stripe refunds one intent at a
-- time. But `order_refunds` allowed exactly one row per order and
-- `pending_refunds()` returned exactly one intent — the largest — so an
-- obligation covering both had nowhere to write its second half.
--
-- `needs_manual_split` flagged that case honestly and resolved into nothing. A
-- human clearing the queue against the biggest intent short-paid the buyer by the
-- smaller charge, and no row recorded the remainder, while `orders.status` already
-- read 'refunded'. That is the failure this file's predecessor warned about in its
-- own first paragraph: the order says "refunded" while the money sat still — the
-- record lies.
--
-- SPLIT: an OBLIGATION and its EXECUTION are different facts.
--
--   order_refunds       WHAT the buyer is owed. Still exactly one per order — a
--                       second settlement must not create a second debt.
--   order_refund_legs   HOW it is being paid. One row per PaymentIntent, each
--                       with its own amount and its own Stripe refund id.
--
-- Keeping the obligation as its own row is not ceremony. `settle_order` guards on
-- the payments flag and the order status, never on whether anything was captured,
-- so an order CAN reach 'refunded' with no charge behind it. Under a legs-only
-- design that debt would produce zero rows and disappear. It must exist even when
-- it cannot be paid.
--
-- This restores what legacy actually had and v2 dropped: refund state tracked per
-- payment rather than per order.

create table if not exists public.order_refund_legs (
  id uuid not null default gen_random_uuid(),
  refund_id uuid not null references public.order_refunds(id) on delete cascade,
  stripe_payment_intent_id text not null,
  amount_cents integer not null,
  stripe_refund_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint order_refund_legs_pkey primary key (id),
  constraint order_refund_legs_amount_positive check (amount_cents > 0),
  constraint order_refund_legs_status_check check (status = any (array['pending','paid','failed'])),
  constraint order_refund_legs_paid_needs_id check (status <> 'paid' or stripe_refund_id is not null)
);

create unique index if not exists idx_order_refund_legs_stripe
  on public.order_refund_legs (stripe_refund_id) where stripe_refund_id is not null;
-- One leg per intent per obligation. A re-allocation must not raise a second debt
-- against a charge that already carries one.
create unique index if not exists idx_order_refund_legs_one_per_intent
  on public.order_refund_legs (refund_id, stripe_payment_intent_id);

alter table public.order_refund_legs enable row level security;
-- No client policy, deliberately. The parties can already read the obligation —
-- what they are owed. Which charge it is being drawn from is execution detail the
-- runner owns, and RLS with no policy denies everyone.

-- The obligation no longer carries a single Stripe refund id: it may take two.
-- The id lives on the leg that actually earned it.
drop index if exists public.idx_order_refunds_stripe;
alter table public.order_refunds drop constraint if exists order_refunds_paid_needs_id;
alter table public.order_refunds drop column if exists stripe_refund_id;

/**
 * Spreads an obligation across the charges that funded it.
 *
 * Largest captured intent first, taking as much of the remaining debt as that
 * charge can cover. The order is amount-neutral — Stripe credits the buyer's card
 * the same whichever charge it is drawn from — and largest-first simply produces
 * the fewest legs.
 *
 * It also falls out correctly for the branches that refund LESS than was
 * captured: a §1 refusal owes the price minus the forfeit deposit, the balance
 * charge covers that on its own, and the deposit charge is never touched.
 *
 * If the captured charges cannot cover the debt, the legs stop short and the
 * obligation simply never reads paid. That is deliberate. Raising here would
 * abort the settlement itself, and a settlement that cannot be paid is still a
 * settlement that must be recorded.
 */
create or replace function public.allocate_refund_legs(target_refund uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  p record;
  remaining integer;
  take integer;
begin
  select * into r from public.order_refunds where id = target_refund;
  if r is null then return; end if;

  remaining := r.amount_cents
             - coalesce((select sum(amount_cents) from public.order_refund_legs
                          where refund_id = target_refund), 0);

  for p in
    select pay.stripe_payment_intent_id, pay.amount_cents
      from public.order_payments pay
     where pay.order_id = r.order_id
       and pay.status = 'captured'
       -- Deterministic: the id breaks a tie between two equal charges so the
       -- same settlement always produces the same legs.
     order by pay.amount_cents desc, pay.stripe_payment_intent_id
  loop
    exit when remaining <= 0;
    take := least(remaining, p.amount_cents);
    insert into public.order_refund_legs (refund_id, stripe_payment_intent_id, amount_cents)
    values (target_refund, p.stripe_payment_intent_id, take)
    on conflict (refund_id, stripe_payment_intent_id) do nothing;
    remaining := remaining - take;
  end loop;
end; $fn$;
revoke execute on function public.allocate_refund_legs(uuid) from anon, authenticated, public;

/**
 * Settling an order that owes the buyer money creates the debt AND its legs.
 */
create or replace function public.refund_on_order_settled()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare owed integer; rid uuid;
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    owed := public.order_buyer_refund_cents(new.id);
    if owed > 0 then
      insert into public.order_refunds (order_id, amount_cents)
      values (new.id, owed)
      on conflict (order_id) do nothing;
      select id into rid from public.order_refunds where order_id = new.id;
      perform public.allocate_refund_legs(rid);
    end if;
  end if;
  return new;
end; $fn$;

/**
 * Refund legs ready to send, each with the charge to send it against.
 *
 * Blocked while any transfer on the order is still unreversed — paying a buyer
 * back money already sent to a seller pays it twice.
 *
 * LEFT JOIN, not inner. An obligation with no captured charge behind it has no
 * legs, and the previous inner join dropped it from the queue entirely: the
 * refund was invisible rather than blocked, and the runner's `no_captured_charge`
 * branch was unreachable. It now returns one row with a null intent, so the debt
 * is surfaced and that branch does its job.
 */
-- Dropped, not replaced: the return type changes, and CREATE OR REPLACE cannot
-- change a function's return type. (A different parameter COUNT would be worse
-- still — it creates a SECOND function and leaves the old one callable.)
drop function if exists public.pending_refunds();
create function public.pending_refunds()
returns table (
  leg_id uuid,
  refund_id uuid,
  order_id uuid,
  amount_cents integer,
  payment_intent_id text,
  unreversed_transfers integer
)
language sql stable security definer set search_path = public as $fn$
  select l.id, r.id, r.order_id,
         coalesce(l.amount_cents, r.amount_cents),
         l.stripe_payment_intent_id,
         (select count(*)::integer from public.order_payouts po
           where po.order_id = r.order_id and po.status = 'paid')
    from public.order_refunds r
    left join public.order_refund_legs l
           on l.refund_id = r.id
          and l.status = 'pending'
          and l.stripe_refund_id is null
   where r.status = 'pending'
     and not exists (
       select 1 from public.order_payouts po
        where po.order_id = r.order_id and po.status = 'paid'
     )
   order by r.created_at asc, l.amount_cents desc nulls last;
$fn$;
revoke execute on function public.pending_refunds() from anon, authenticated, public;

/**
 * Records that one leg actually went out, and closes the obligation once its legs
 * cover it.
 *
 * Idempotent on the Stripe refund id: a runner that crashes between calling
 * Stripe and writing the result retries safely, and the second attempt finds the
 * leg already marked.
 *
 * The obligation reads 'paid' only when the legs SUM to what was owed. A single
 * leg closing a two-leg debt is exactly the short-pay this whole change exists to
 * make impossible.
 */
drop function if exists public.mark_refund_paid(uuid, text);
create or replace function public.mark_refund_leg_paid(target_leg uuid, stripe_id text)
returns void language plpgsql security definer set search_path = public as $fn$
declare existing uuid; parent uuid; owed integer; settled integer;
begin
  if stripe_id is null or btrim(stripe_id) = '' then raise exception 'refund_id_required'; end if;

  select id into existing from public.order_refund_legs
   where stripe_refund_id = btrim(stripe_id);
  if existing is not null then return; end if;

  update public.order_refund_legs set
    stripe_refund_id = btrim(stripe_id), status = 'paid', paid_at = now()
  where id = target_leg and status = 'pending'
  returning order_refund_legs.refund_id into parent;
  if parent is null then return; end if;

  select amount_cents into owed from public.order_refunds where id = parent;
  select coalesce(sum(amount_cents), 0) into settled
    from public.order_refund_legs where refund_id = parent and status = 'paid';

  if settled >= owed then
    update public.order_refunds set status = 'paid', paid_at = now() where id = parent;
  end if;
end; $fn$;
revoke execute on function public.mark_refund_leg_paid(uuid, text) from anon, authenticated, public;
