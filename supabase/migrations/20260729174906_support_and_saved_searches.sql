-- Phase A.7 — support tickets + saved searches (V6-04, V2-04).
--
-- Support: legacy's form worked but its admin queue could never change a
-- status and no email ever sent. Here the lifecycle is real (admin
-- transitions via definer, audited) and the confirmation email rides the
-- existing Resend wiring at the app layer.
--
-- Saved searches: legacy built the whole feature and never mounted its
-- creation UI; the notify flag was discarded on save and nothing ever acted
-- on it. This is its first real implementation.

-- ============================================================== SUPPORT
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() not null,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz default now() not null,
  constraint support_tickets_pkey primary key (id),
  constraint support_tickets_category_check check (category in (
    'account','listing','transaction','bug','feature','feedback','other'
  )),
  constraint support_tickets_status_check check (status in (
    'open','in_progress','resolved'
  )),
  constraint support_tickets_name_check check (length(btrim(name)) between 2 and 100),
  constraint support_tickets_email_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint support_tickets_subject_check check (length(btrim(subject)) between 5 and 200),
  constraint support_tickets_message_check check (length(btrim(message)) between 10 and 10000)
);
create index if not exists idx_support_tickets_status
  on public.support_tickets using btree (status, created_at desc);

alter table public.support_tickets enable row level security;

-- Guests may file (locked-out-of-account is the #1 support case); authed
-- users file as themselves. Own-read for authed; admins read all. NO email
-- enumeration path: guests get their reference id from the insert response
-- only.
create policy "authed file own ticket" on public.support_tickets
for insert to authenticated
with check (profile_id is null or profile_id = (select auth.uid()));

create policy "guest file ticket" on public.support_tickets
for insert to anon
with check (profile_id is null);

create policy "own read tickets" on public.support_tickets
for select to authenticated
using (profile_id = (select auth.uid()) or public.is_platform_admin());

-- Status transitions are admin-only, through a definer, audited via the
-- verification_events pattern's sibling: plain admin_notes trail + timestamps.
create or replace function public.update_support_ticket(
  target_ticket uuid, new_status text, note text default null
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if new_status not in ('open','in_progress','resolved') then
    raise exception 'bad_status';
  end if;
  update public.support_tickets
     set status = new_status,
         admin_notes = case
           when note is null then admin_notes
           else coalesce(admin_notes || chr(10), '') || note
         end,
         resolved_at = case when new_status = 'resolved' then now() else resolved_at end
   where id = target_ticket;
  if not found then raise exception 'not_found'; end if;
end; $fn$;

revoke execute on function public.update_support_ticket(uuid, text, text) from anon, public;
grant execute on function public.update_support_ticket(uuid, text, text) to authenticated;

-- ========================================================= SAVED SEARCHES
create table if not exists public.saved_searches (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  query text,
  species text,
  listing_kind text,
  min_price_cents integer,
  max_price_cents integer,
  notify_enabled boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz default now() not null,
  constraint saved_searches_pkey primary key (id),
  constraint saved_searches_name_check check (length(btrim(name)) between 1 and 80),
  constraint saved_searches_kind_check check (
    listing_kind is null or listing_kind in ('sale','adoption')
  ),
  -- A per-user cap keeps the matcher's fan-out bounded.
  constraint saved_searches_price_order check (
    min_price_cents is null or max_price_cents is null
    or min_price_cents <= max_price_cents
  )
);
create index if not exists idx_saved_searches_profile
  on public.saved_searches using btree (profile_id);
create index if not exists idx_saved_searches_notify
  on public.saved_searches using btree (notify_enabled) where notify_enabled;

alter table public.saved_searches enable row level security;
create policy "own saved searches" on public.saved_searches
for select to authenticated using (profile_id = (select auth.uid()));
create policy "own insert saved searches" on public.saved_searches
for insert to authenticated with check (
  profile_id = (select auth.uid())
  and (select count(*) from public.saved_searches s
        where s.profile_id = (select auth.uid())) < 20
);
create policy "own update saved searches" on public.saved_searches
for update to authenticated using (profile_id = (select auth.uid()));
create policy "own delete saved searches" on public.saved_searches
for delete to authenticated using (profile_id = (select auth.uid()));

-- The matcher: a new PUBLISHED listing notifies every matching saved search
-- (except the seller's own). Notification kinds widen once more — this is
-- the canonical full list going forward (supersedes A.3's list).
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'follow','reaction','comment','comment_reply','inquiry',
    'pack_invite','pack_accepted','saved_search_match'
  ]));

create or replace function public.notify_saved_search_matches()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.notifications (recipient_id, actor_id, kind, target_kind, target_id)
  select s.profile_id, new.seller_id, 'saved_search_match', 'listing', new.id
    from public.saved_searches s
   where s.notify_enabled
     and s.profile_id <> new.seller_id
     and (s.listing_kind is null or s.listing_kind = new.listing_kind)
     and (s.min_price_cents is null or new.price_cents >= s.min_price_cents)
     and (s.max_price_cents is null or new.price_cents <= s.max_price_cents)
     and (
       s.species is null
       or exists (
         select 1 from public.creatures c
         where c.id = new.creature_id
           and lower(c.species) = lower(s.species)
       )
     )
     and (
       s.query is null or btrim(s.query) = ''
       or new.title ilike '%' || s.query || '%'
       or coalesce(new.description, '') ilike '%' || s.query || '%'
     );
  return new;
end; $fn$;

drop trigger if exists listings_notify_saved_searches on public.listings;
create trigger listings_notify_saved_searches
after insert on public.listings
for each row execute function public.notify_saved_search_matches();

revoke execute on function public.notify_saved_search_matches() from anon, authenticated, public;
