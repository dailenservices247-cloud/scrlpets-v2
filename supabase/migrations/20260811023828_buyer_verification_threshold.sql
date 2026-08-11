-- Buyer-side identity verification above a threshold.
--
-- The asymmetry this closes: sellers are identity-verified with money and a
-- reputation on the line. Buyers are an email address. A scammer does not need to
-- be a breeder — they need to be a BUYER. Sign up free, pay by card, take the
-- animal, and dispute. If the platform's adjudication goes against them they
-- still have roughly 120 days to charge back with their issuer, and no amount of
-- policy reaches that.
--
-- Requiring a government ID on file before a high-value animal purchase does two
-- things: it deters the casual version outright, and it turns a chargeback into
-- an argument the platform can win, because the representment package now
-- includes an identity check alongside the code entry, anchor scan and delivery
-- confirmation.
--
-- $500 (50,000 cents), and the reasoning for the number:
--   - BELOW it sits most of the shipped category — reptiles, inverts, small
--     animals — where per-transaction exposure is low and an ID wall would kill
--     the category's conversion for no real protection.
--   - ABOVE it sits essentially every dog, cat and bird worth stealing.
--   - Identity is a property of a PERSON, not a transaction, so the ~$1.50 check
--     is one-time per buyer. A repeat buyer never pays it again.
--
-- Checked at ORDER CREATION, before the card is touched. A buyer charged and
-- then blocked is a support ticket and a chargeback risk of its own.
--
-- ANIMALS ONLY. Merchandise and services carry the same fraud shape but not the
-- same stakes: goods can be returned, an animal cannot be un-delivered.

/**
 * The honest name for what identity_verifications actually records. is_verified_seller
 * asks the same question and is referenced by RLS policies, so it stays and
 * delegates here rather than being renamed out from under them.
 */
create or replace function public.is_identity_verified(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.identity_verifications
     where profile_id = target_profile and status = 'verified'
  );
$fn$;
revoke execute on function public.is_identity_verified(uuid) from anon, public;
grant execute on function public.is_identity_verified(uuid) to authenticated;

create or replace function public.is_verified_seller(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_identity_verified(target_profile);
$fn$;

/**
 * ponytail: a function rather than a config row. One number, changed rarely, and
 * a table would need its own RLS and its own "who may move the threshold"
 * question. Promote it the first time it needs to vary by species or region.
 */
create or replace function public.buyer_verification_threshold_cents()
returns integer language sql immutable as $fn$ select 50000; $fn$;

create or replace function public.create_order(target_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  oid uuid;
  b_bps integer; s_bps integer; b_fee integer; s_fee integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into l from public.listings where id = target_listing and deleted_at is null;
  if l is null then raise exception 'listing_not_found'; end if;
  if l.seller_id = uid then raise exception 'cannot_buy_own_listing'; end if;
  if l.availability <> 'available' then raise exception 'listing_unavailable'; end if;
  if l.price_cents <= 0 then raise exception 'listing_not_priced'; end if;

  if l.creature_id is not null then
    if not public.is_verified_seller(l.seller_id) then raise exception 'seller_not_verified'; end if;
    if not public.is_animal_listable(l.creature_id) then raise exception 'animal_not_listable'; end if;

    -- The buyer side of the same gate, above the threshold.
    if l.price_cents >= public.buyer_verification_threshold_cents()
       and not public.is_identity_verified(uid) then
      raise exception 'buyer_verification_required';
    end if;
  end if;

  if not public.can_receive_payouts(l.seller_id) then raise exception 'seller_cannot_receive_payouts'; end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(l.seller_id);
  b_fee := least(round(l.price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(l.price_cents * s_bps / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, listing_id, title_snapshot, amount_cents, currency,
    buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents
  )
  values (uid, l.seller_id, l.id, l.title, l.price_cents, l.currency,
          b_bps, s_bps, b_fee, s_fee)
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'draft',
          'order created; buyer ' || b_bps || 'bps=' || b_fee ||
          ', seller ' || s_bps || 'bps=' || s_fee);
  return oid;
end; $fn$;
revoke execute on function public.create_order(uuid) from anon, public;
grant execute on function public.create_order(uuid) to authenticated;
