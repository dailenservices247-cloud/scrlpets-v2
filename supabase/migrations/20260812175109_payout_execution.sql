-- The other half of the money: getting it OUT.
--
-- A completed sale left the seller with a `pending` payout row and no money.
-- `accept_delivery` and `release_expired_inspections` flip an order to
-- `released`, and `record_order_payout` records that a payout is OWED — but
-- nothing ever executed it, because a Stripe transfer cannot happen inside a
-- database trigger.
--
-- So the database owns WHAT is owed and to WHOM; a server-side runner owns the
-- Stripe call. This split is deliberate: the amounts stay derived from the order
-- and cannot be supplied by whatever process happens to be executing.

/**
 * Payout legs that are owed and not yet sent, with the destination account.
 *
 * Service-role only. A member has no business enumerating who is owed what, and
 * the runner is the only caller.
 *
 * The seller's leg is DERIVED here rather than recorded at release: it is the
 * price less their fee, less any fee credit they spent, and computing it in one
 * place keeps it impossible for the recorded figure and the real one to drift.
 */
create or replace function public.pending_payouts()
returns table (
  payout_id uuid,
  order_id uuid,
  recipient_id uuid,
  leg text,
  amount_cents integer,
  destination_account text,
  currency text
)
language sql stable security definer set search_path = public as $fn$
  select p.id, p.order_id, p.recipient_id, p.leg, p.amount_cents,
         a.stripe_account_id, o.currency
    from public.order_payouts p
    join public.orders o on o.id = p.order_id
    join public.seller_payout_accounts a on a.profile_id = p.recipient_id
   where p.status = 'pending'
     and p.stripe_transfer_id is null
     and a.payouts_enabled
     -- Only once the sale is actually done. A transporter's leg is created at
     -- pickup, but paying it before release would move money out of an order
     -- that might still be refunded in full.
     and o.status = 'released'
   order by p.created_at asc;
$fn$;
revoke execute on function public.pending_payouts() from anon, authenticated, public;

/**
 * Records that a transfer actually happened.
 *
 * Idempotent on the Stripe transfer id: a runner that crashes between calling
 * Stripe and writing the result can safely retry, and the second attempt finds
 * the row already marked rather than creating a duplicate.
 */
create or replace function public.mark_payout_paid(target_payout uuid, transfer_id text)
returns void language plpgsql security definer set search_path = public as $fn$
declare existing uuid;
begin
  if transfer_id is null or btrim(transfer_id) = '' then raise exception 'transfer_id_required'; end if;

  select id into existing from public.order_payouts where stripe_transfer_id = btrim(transfer_id);
  if existing is not null then return; end if;

  update public.order_payouts set
    stripe_transfer_id = btrim(transfer_id),
    status = 'paid',
    paid_at = now()
  where id = target_payout and status = 'pending';
end; $fn$;
revoke execute on function public.mark_payout_paid(uuid, text) from anon, authenticated, public;

/**
 * The seller's payout leg, created when the order releases.
 *
 * A trigger rather than an edit to four release paths (buyer acceptance, window
 * elapsing, a §4 not-covered settlement, a replacement settlement) — a future
 * fifth path cannot forget to create it.
 *
 * The transporter's leg already exists from pickup and is untouched here: they
 * are paid for the journey, and the journey happened whatever the outcome.
 */
create or replace function public.payout_on_order_released()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare owed integer;
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    owed := new.amount_cents
          - (new.seller_fee_cents - coalesce(new.seller_fee_credit_cents, 0));
    if owed > 0 and not exists (
      select 1 from public.order_payouts
       where order_id = new.id and leg = 'seller'
    ) then
      perform public.record_order_payout(new.id, new.seller_id, 'seller', owed, null);
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists trg_payout_on_order_released on public.orders;
create trigger trg_payout_on_order_released
after update of status on public.orders
for each row execute function public.payout_on_order_released();
