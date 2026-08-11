-- The adjudicator could not see the disputes.
--
-- `settle_order` checks is_platform_admin(), so an admin may DECIDE an order —
-- but `orders` RLS is "buyer or seller only", so an admin cannot READ one. The
-- sole adjudicator at launch had a verdict button and no case file, and would
-- have been running SQL by hand against live money the first time a real dispute
-- landed.
--
-- Same shape as the admin note accessors: a definer that checks the role itself
-- and returns an empty set to everybody else, so a caller who forgets to check
-- renders nothing rather than leaking through an error message.
--
-- The evidence package is assembled HERE rather than in the page, because it is
-- also the chargeback representment package. Timestamped code entry, the anchor
-- scan, tracking, delivery confirmation and the seller's own published remedy
-- are exactly what wins a representment, and they should come out of one query
-- that can be pointed at a card network as easily as at a screen.

create or replace function public.admin_dispute_queue()
returns table (
  order_id uuid,
  buyer_username text,
  seller_username text,
  title_snapshot text,
  fulfilment text,
  status text,
  amount_cents integer,
  deposit_cents integer,
  transport_cents integer,
  buyer_fee_cents integer,
  seller_fee_cents integer,
  picked_up_at timestamptz,
  handover_at timestamptz,
  delivered_at timestamptz,
  animal_returned_at timestamptz,
  carrier text,
  tracking_number text,
  inspection_ends_at timestamptz,
  anchor_verified boolean,
  guarantee_branch text,
  guarantee_headline text,
  dispute_reason text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $fn$
  select
    o.id,
    b.username,
    s.username,
    o.title_snapshot,
    o.fulfilment,
    o.status,
    o.amount_cents,
    o.deposit_cents,
    o.transport_cents,
    o.buyer_fee_cents,
    o.seller_fee_cents,
    o.picked_up_at,
    o.handover_at,
    o.delivered_at,
    o.animal_returned_at,
    o.carrier,
    o.tracking_number,
    o.inspection_ends_at,
    -- The anchor was checked if a handover event recorded it. Derived from the
    -- append-only trail rather than a flag somebody could have forgotten to set.
    exists (
      select 1 from public.order_events e
       where e.order_id = o.id
         and (e.note like '%anchor verified%' or e.note like '%code and anchor%')
    ),
    public.listing_guarantee_branch(o.listing_id),
    (select g.headline from public.listing_guarantee_text(o.listing_id) g),
    (select e.note from public.order_events e
      where e.order_id = o.id and e.to_status = 'disputed'
      order by e.created_at desc limit 1),
    o.created_at
  from public.orders o
  left join public.profiles b on b.id = o.buyer_id
  left join public.profiles s on s.id = o.seller_id
  where public.is_platform_admin()
    and o.status = 'disputed'
  order by o.created_at asc;
$fn$;
revoke execute on function public.admin_dispute_queue() from anon, public;
grant execute on function public.admin_dispute_queue() to authenticated;

/**
 * The full trail for one order. Separate from the queue so the list stays cheap
 * and the detail is fetched only when an adjudicator opens a case.
 */
create or replace function public.admin_order_events(target_order uuid)
returns table (created_at timestamptz, from_status text, to_status text, note text, actor text)
language sql stable security definer set search_path = public as $fn$
  select e.created_at, e.from_status, e.to_status, e.note, p.username
    from public.order_events e
    left join public.profiles p on p.id = e.actor_id
   where public.is_platform_admin()
     and e.order_id = target_order
   order by e.created_at asc;
$fn$;
revoke execute on function public.admin_order_events(uuid) from anon, public;
grant execute on function public.admin_order_events(uuid) to authenticated;
