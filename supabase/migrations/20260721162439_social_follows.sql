-- Social follows (follows/block/report lane, sub-slice 1). Person→person only;
-- following brands is a separate banked item.

create table if not exists public.follows (
  id uuid default gen_random_uuid() not null,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  constraint follows_pkey primary key (id),
  constraint follows_unique_pair unique (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists idx_follows_follower on public.follows using btree (follower_id);
create index if not exists idx_follows_following on public.follows using btree (following_id);

alter table public.follows enable row level security;

-- Follow graph is public (counts + who-follows-whom are standard-social public).
create policy "public read follows" on public.follows
for select to anon, authenticated
using (true);

-- A user may only create/remove their OWN follow edges.
create policy "own insert follows" on public.follows
for insert to authenticated
with check (follower_id = (select auth.uid()));

create policy "own delete follows" on public.follows
for delete to authenticated
using (follower_id = (select auth.uid()));
