-- Phase A.3 — the Pack graph + alumni (grill Q1/Q7, V4-05/V4-08, V1-02).
--
-- "Pack" platform-wide (Dailen, grill Q1). Two doors, both from legacy's
-- design, neither from its code (its Accept button wrote constraint-illegal
-- statuses and its notifications structurally never fired):
--   Door 1 — social: invite → accept/decline, withdrawable, deduped.
--   Door 2 — commerce: a both-party-confirmed handover auto-creates an
--   ACCEPTED pack link + an alumni record (grill Q7: confirmation IS the
--   consent moment; both are removable; blocks sever).

-- ================================================================ PACK LINKS
create table if not exists public.pack_links (
  id uuid default gen_random_uuid() not null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  -- Door 2 tags the link with what created it.
  origin text not null default 'invite',
  origin_creature_id uuid references public.creatures(id) on delete set null,
  created_at timestamptz default now() not null,
  accepted_at timestamptz,
  constraint pack_links_pkey primary key (id),
  constraint pack_links_status_check check (status in ('pending','accepted')),
  constraint pack_links_origin_check check (origin in ('invite','handover')),
  constraint pack_links_not_self check (requester_id <> addressee_id)
);
-- One link per unordered pair: enforce via a normalized-pair unique index.
create unique index if not exists idx_pack_links_pair on public.pack_links
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists idx_pack_links_addressee
  on public.pack_links using btree (addressee_id, status);

alter table public.pack_links enable row level security;

-- Both parties read their own links. Blocks hide the other side's row the
-- same way follows behave (the block itself severs — see trigger below).
create policy "read own pack links" on public.pack_links
for select to authenticated
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- Invite: requester inserts pending. Accept: addressee flips to accepted.
-- Withdraw/decline/leave: either party deletes. Origin fields are frozen by
-- trigger; handover-origin rows are inserted only by the definer path.
create policy "send pack invite" on public.pack_links
for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and status = 'pending'
  and origin = 'invite'
  and not public.is_suspended((select auth.uid()))
  -- No inviting someone who blocked you or whom you blocked.
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = pack_links.requester_id and b.blocked_id = pack_links.addressee_id)
       or (b.blocker_id = pack_links.addressee_id and b.blocked_id = pack_links.requester_id)
  )
);

create policy "addressee accepts pack invite" on public.pack_links
for update to authenticated
using (addressee_id = (select auth.uid()))
with check (addressee_id = (select auth.uid()) and status = 'accepted');

create policy "either party removes pack link" on public.pack_links
for delete to authenticated
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- Freeze identity + origin on update; stamp accepted_at exactly once.
create or replace function public.enforce_pack_link_update()
returns trigger language plpgsql as $fn$
begin
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.origin is distinct from old.origin
     or new.origin_creature_id is distinct from old.origin_creature_id then
    raise exception 'pack_link_identity_immutable';
  end if;
  if old.status = 'accepted' and new.status = 'pending' then
    raise exception 'pack_link_no_unaccept';
  end if;
  if new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at := now();
  end if;
  return new;
end; $fn$;

drop trigger if exists pack_links_update_guard on public.pack_links;
create trigger pack_links_update_guard
before update on public.pack_links
for each row execute function public.enforce_pack_link_update();

-- A block severs the pack link both directions (same policy as follows).
create or replace function public.sever_pack_on_block()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.pack_links
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end; $fn$;

drop trigger if exists block_severs_pack on public.blocks;
create trigger block_severs_pack
after insert on public.blocks
for each row execute function public.sever_pack_on_block();

-- Pack notifications MUST fire (legacy's never did). Invite → addressee;
-- acceptance → requester. Rides the existing trigger-written notifications
-- table; both CHECK constraints widen to admit the pack vocabulary.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['follow','reaction','comment','comment_reply','inquiry','pack_invite','pack_accepted']));
alter table public.notifications drop constraint if exists notifications_target_kind_check;
alter table public.notifications add constraint notifications_target_kind_check
  check (target_kind is null or target_kind = any (array['post','comment','listing','profile','pack_link']));

create or replace function public.notify_pack_events()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, kind, target_kind, target_id)
    values (new.addressee_id, new.requester_id, 'pack_invite', 'pack_link', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, kind, target_kind, target_id)
    values (new.requester_id, new.addressee_id, 'pack_accepted', 'pack_link', new.id);
  end if;
  return new;
end; $fn$;

drop trigger if exists pack_links_notify on public.pack_links;
create trigger pack_links_notify
after insert or update on public.pack_links
for each row execute function public.notify_pack_events();

-- ==================================================================== ALUMNI
-- "Where did my animals end up" — the retention loop legacy built two full
-- pages for and never gave an entry point. Rows exist ONLY via the handover
-- trigger below; no client write path at all.
create table if not exists public.alumni (
  id uuid default gen_random_uuid() not null,
  creature_id uuid references public.creatures(id) on delete set null,
  breeder_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.buyer_applications(id) on delete cascade,
  handover_at timestamptz not null,
  muted_by_breeder boolean not null default false,
  muted_by_owner boolean not null default false,
  created_at timestamptz default now() not null,
  constraint alumni_pkey primary key (id),
  constraint alumni_one_per_application unique (application_id)
);
create index if not exists idx_alumni_breeder on public.alumni (breeder_id);
create index if not exists idx_alumni_owner on public.alumni (owner_id);

alter table public.alumni enable row level security;

create policy "parties read own alumni" on public.alumni
for select to authenticated
using (breeder_id = (select auth.uid()) or owner_id = (select auth.uid()));

-- Each side controls only its own mute flag ("removable" per grill Q7 —
-- muting hides the loop without destroying the record's history).
create policy "parties mute own side" on public.alumni
for update to authenticated
using (breeder_id = (select auth.uid()) or owner_id = (select auth.uid()))
with check (breeder_id = (select auth.uid()) or owner_id = (select auth.uid()));

create or replace function public.enforce_alumni_update()
returns trigger language plpgsql as $fn$
begin
  if new.creature_id is distinct from old.creature_id
     or new.breeder_id is distinct from old.breeder_id
     or new.owner_id is distinct from old.owner_id
     or new.application_id is distinct from old.application_id
     or new.handover_at is distinct from old.handover_at then
    raise exception 'alumni_identity_immutable';
  end if;
  if new.muted_by_breeder is distinct from old.muted_by_breeder
     and (select auth.uid()) is distinct from old.breeder_id then
    raise exception 'not_your_mute_flag';
  end if;
  if new.muted_by_owner is distinct from old.muted_by_owner
     and (select auth.uid()) is distinct from old.owner_id then
    raise exception 'not_your_mute_flag';
  end if;
  return new;
end; $fn$;

drop trigger if exists alumni_update_guard on public.alumni;
create trigger alumni_update_guard
before update on public.alumni
for each row execute function public.enforce_alumni_update();

-- ======================================================= DOOR 2 (handover)
-- Fires on the SAME event as referral conversion and review eligibility: a
-- buyer_applications row where both confirmations are set. Idempotent on
-- both artifacts.
create or replace function public.pack_alumni_on_handover()
returns trigger language plpgsql security definer set search_path = public as $fn$
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
end; $fn$;

drop trigger if exists handover_creates_pack_alumni on public.buyer_applications;
create trigger handover_creates_pack_alumni
after update on public.buyer_applications
for each row execute function public.pack_alumni_on_handover();

revoke execute on function public.enforce_pack_link_update() from anon, authenticated, public;
revoke execute on function public.sever_pack_on_block() from anon, authenticated, public;
revoke execute on function public.notify_pack_events() from anon, authenticated, public;
revoke execute on function public.enforce_alumni_update() from anon, authenticated, public;
revoke execute on function public.pack_alumni_on_handover() from anon, authenticated, public;
