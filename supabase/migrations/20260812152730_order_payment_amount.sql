-- The charge path needs one thing the database has to own: how much this
-- payment is for.
--
-- The amount cannot come from the client. A checkout page that computes its own
-- figure and hands it to Stripe is a checkout page that can be told to charge
-- $1 for a $2,000 animal — and `record_order_payment` books whatever Stripe
-- says was captured, so an under-charge would sail through as a legitimate
-- deposit and leave the order permanently short of funds_held.
--
-- Deposit is a PORTION of the price, so a deposit payment is deposit_cents and
-- the balance is everything still owed. Both derive from order_due_cents, which
-- already accounts for transport and the buyer fee less any points credit.

create or replace function public.order_payment_amount(target_order uuid, payment_kind text)
returns integer language plpgsql stable security definer set search_path = public as $fn$
declare
  o record;
  due integer;
  captured integer;
begin
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if (select auth.uid()) is distinct from o.buyer_id then raise exception 'not_the_buyer'; end if;
  if o.status not in ('draft','awaiting_payment','deposit_held') then
    raise exception 'nothing_left_to_pay';
  end if;

  due := public.order_due_cents(target_order);
  captured := public.order_captured_cents(target_order);

  if payment_kind = 'deposit' then
    if o.deposit_cents <= 0 then raise exception 'no_deposit_on_this_order'; end if;
    if captured > 0 then raise exception 'deposit_already_paid'; end if;
    return o.deposit_cents;
  elsif payment_kind in ('balance','full') then
    if due - captured <= 0 then raise exception 'nothing_left_to_pay'; end if;
    return due - captured;
  else
    raise exception 'unknown_payment_kind';
  end if;
end; $fn$;
revoke execute on function public.order_payment_amount(uuid, text) from anon, public;
grant execute on function public.order_payment_amount(uuid, text) to authenticated;

/**
 * The seller's connected account, for `on_behalf_of` at charge time. Legacy used
 * this as a liability shield and the intent is worth keeping: it makes the
 * seller the merchant of record for the sale rather than the platform.
 *
 * Returns null when they have no account, so the caller omits the parameter
 * rather than sending a broken one.
 */
create or replace function public.order_seller_stripe_account(target_order uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select a.stripe_account_id
    from public.orders o
    join public.seller_payout_accounts a on a.profile_id = o.seller_id
   where o.id = target_order
     and (select auth.uid()) in (o.buyer_id, o.seller_id)
     and a.payouts_enabled;
$fn$;
revoke execute on function public.order_seller_stripe_account(uuid) from anon, public;
grant execute on function public.order_seller_stripe_account(uuid) to authenticated;
