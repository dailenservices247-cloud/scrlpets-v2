-- Step 4: somewhere for three people to talk about one animal.
--
-- A driver running two hours late had no way to tell anyone. `conversations` is
-- strictly two-party — user_a and user_b, no participants table — so a third
-- person cannot join one.
--
-- WHY NOT GENERALISE `conversations`. It carries the rule that an active
-- conversation is EARNED rather than self-declared (an accepted pack link, or a
-- definer minting it), enforced by a RESTRICTIVE policy. Rewriting a two-party
-- table into an n-party one means rewriting that policy, and getting it wrong
-- means strangers can open threads with breeders. That is a large, risky change
-- to a working security surface for one feature.
--
-- MEMBERSHIP IS DERIVED, NOT STORED. There is no participants table: you are in
-- this thread if you are the buyer, the seller, or the transporter ON THE ORDER.
-- That means nobody can add themselves, a transporter booked later joins
-- automatically, and a membership list cannot drift out of step with who is
-- actually involved. The order IS the thread.

create table if not exists public.order_messages (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint order_messages_pkey primary key (id),
  constraint order_messages_body_not_blank check (btrim(body) <> ''),
  constraint order_messages_body_length check (char_length(body) <= 4000)
);

create index if not exists idx_order_messages_order
  on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

/**
 * A party to the order, whoever that currently is. Deliberately a function so
 * the read policy, the write policy and any future surface all ask the same
 * question — three copies of this predicate is three chances to let the wrong
 * person in.
 */
create or replace function public.is_order_party(target_order uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.orders o
     where o.id = target_order
       and who in (o.buyer_id, o.seller_id, o.transporter_id)
  );
$fn$;
revoke execute on function public.is_order_party(uuid, uuid) from anon, public;
grant execute on function public.is_order_party(uuid, uuid) to authenticated;

create policy "order parties read the thread" on public.order_messages
for select to authenticated
using (public.is_order_party(order_id, (select auth.uid())));

/**
 * You may only post AS yourself, and only into an order you are part of. The
 * sender check is what stops a party writing a message attributed to somebody
 * else in the same thread — which in a dispute would be evidence.
 */
create policy "order parties write as themselves" on public.order_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_order_party(order_id, (select auth.uid()))
);

-- No UPDATE or DELETE policy at all. This thread is dispute evidence: a message
-- somebody can edit or remove after the fact is worth nothing when two people
-- disagree about what was agreed. Same reasoning as order_events being
-- append-only.

/**
 * The thread, with names attached. A definer so a driver can see the buyer's and
 * seller's usernames without being granted a general read over profiles.
 */
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
   order by m.created_at asc;
$fn$;
revoke execute on function public.order_thread(uuid) from anon, public;
grant execute on function public.order_thread(uuid) to authenticated;

/**
 * Post to the thread.
 *
 * Deliberately NOT gated on `payments_enabled`. Every other order function is,
 * because they move money — this one moves words, and a party locked out of
 * talking during a dispute is exactly the wrong failure. A thread that goes
 * quiet when things go wrong is worse than no thread.
 */
create or replace function public.post_order_message(target_order uuid, body text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); mid uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if body is null or btrim(body) = '' then raise exception 'body_required'; end if;
  if not public.is_order_party(target_order, uid) then raise exception 'not_a_party'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  insert into public.order_messages (order_id, sender_id, body)
  values (target_order, uid, btrim(body))
  returning id into mid;
  return mid;
end; $fn$;
revoke execute on function public.post_order_message(uuid, text) from anon, public;
grant execute on function public.post_order_message(uuid, text) to authenticated;
