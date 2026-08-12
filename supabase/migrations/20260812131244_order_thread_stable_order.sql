-- Two messages sharing a created_at ordered arbitrarily. `now()` is the
-- TRANSACTION start time in Postgres, so anything writing several messages in
-- one transaction stamps them identically — and a conversation that reorders
-- itself between reads is unusable as dispute evidence, which is what this
-- thread is for.
--
-- Found by a probe whose assertion picked "the last message" and got the first
-- one back.
--
-- uuid v4 ids are not ordered, so this is a TIEBREAK for determinism, not a
-- claim about which of two same-instant messages came first. Nothing can
-- recover that ordering after the fact; the point is that the answer stops
-- changing between reads.

create or replace function public.order_thread(target_order uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_username text,
  sender_role text,
  body text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $fn$
  select m.id, m.sender_id, p.username,
         case
           when m.sender_id = o.buyer_id then 'buyer'
           when m.sender_id = o.seller_id then 'seller'
           when m.sender_id = o.transporter_id then 'transporter'
           else 'former_party'
         end,
         m.body, m.created_at
    from public.order_messages m
    join public.orders o on o.id = m.order_id
    left join public.profiles p on p.id = m.sender_id
   where m.order_id = target_order
     and public.is_order_party(target_order, (select auth.uid()))
   order by m.created_at asc, m.id asc;
$fn$;
revoke execute on function public.order_thread(uuid) from anon, public;
grant execute on function public.order_thread(uuid) to authenticated;
