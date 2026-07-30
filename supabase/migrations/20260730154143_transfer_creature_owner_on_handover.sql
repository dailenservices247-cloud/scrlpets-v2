-- The animal never actually changed hands.
--
-- pack_alumni_on_handover wrote the alumni row (naming the buyer as owner_id)
-- and the pack link, but left creatures.owner_id pointing at the seller. No
-- other trigger, RPC or app path transfers it either — grep of every migration
-- and of src/lib finds no write to creatures.owner_id after creation. So a
-- completed, both-sides-confirmed handover left two sources of truth
-- disagreeing about who owns the animal, with the stale one winning
-- everywhere it mattered:
--
--   * /c/[slug] showed the seller as owner, so "Message owner" opened a
--     conversation with the person who no longer has the animal.
--   * Owner-only RLS still answered to the seller: they could keep editing the
--     animal, manage its highlights, and relist it, while the buyer — the
--     actual owner — could do none of those things to their own animal.
--
-- Ownership moves with the handover. The `c.owner_id = new.seller_id` guard
-- keeps this idempotent and refuses to reassign an animal that has already
-- moved on to someone else.

create or replace function public.pack_alumni_on_handover()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pair_exists boolean;
begin
  if new.buyer_confirmed_at is null or new.seller_confirmed_at is null then
    return new;
  end if;
  if new.buyer_id = new.seller_id then return new; end if;

  -- Alumni: one per application, animal from the listing when present.
  insert into public.alumni (creature_id, breeder_id, owner_id, application_id, handover_at)
  select l.creature_id, new.seller_id, new.buyer_id, new.id,
         greatest(new.buyer_confirmed_at, new.seller_confirmed_at)
    from public.listings l
   where l.id = new.listing_id
  on conflict (application_id) do nothing;

  -- The animal itself follows the handover. creatures.slug is globally unique
  -- rather than per-owner, so moving the row cannot collide.
  update public.creatures c
     set owner_id = new.buyer_id
    from public.listings l
   where l.id = new.listing_id
     and c.id = l.creature_id
     and c.owner_id = new.seller_id;

  -- Pack link: auto-accepted, handover origin — unless a link already exists
  -- (any status) or a block stands between the parties.
  select exists (
    select 1 from public.pack_links p
    where least(p.requester_id, p.addressee_id) = least(new.seller_id, new.buyer_id)
      and greatest(p.requester_id, p.addressee_id) = greatest(new.seller_id, new.buyer_id)
  ) into pair_exists;

  if not pair_exists and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.seller_id and b.blocked_id = new.buyer_id)
       or (b.blocker_id = new.buyer_id and b.blocked_id = new.seller_id)
  ) then
    insert into public.pack_links
      (requester_id, addressee_id, status, origin, origin_creature_id, accepted_at)
    select new.seller_id, new.buyer_id, 'accepted', 'handover', l.creature_id, now()
      from public.listings l where l.id = new.listing_id;
  end if;

  return new;
end; $function$;
