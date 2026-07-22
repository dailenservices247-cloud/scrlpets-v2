-- Reactions + saves (comments/reactions/saves lane, sub-slice 1). Posts-family
-- only (post/reel/long_video are all posts rows); listings/promos banked.

-- ── Reactions ───────────────────────────────────────────────────────────────
-- One active reaction per user per post, from a fixed set, changeable. Public
-- read (counts are public).
create table if not exists public.post_reactions (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now() not null,
  constraint post_reactions_pkey primary key (id),
  constraint post_reactions_unique_pair unique (post_id, user_id),
  constraint post_reactions_type_check check (
    reaction_type = any (array['like','love','laugh','wow','sad','strong'])
  )
);

create index if not exists idx_post_reactions_post on public.post_reactions using btree (post_id);

alter table public.post_reactions enable row level security;

create policy "public read reactions" on public.post_reactions
for select to anon, authenticated
using (true);

create policy "own insert reactions" on public.post_reactions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "own update reactions" on public.post_reactions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "own delete reactions" on public.post_reactions
for delete to authenticated
using (user_id = (select auth.uid()));

-- ── Saves ───────────────────────────────────────────────────────────────────
-- Private bookmarks: owner-only in every direction (a save list is personal).
create table if not exists public.saved_posts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now() not null,
  constraint saved_posts_pkey primary key (id),
  constraint saved_posts_unique_pair unique (user_id, post_id)
);

create index if not exists idx_saved_posts_user on public.saved_posts using btree (user_id, created_at desc);

alter table public.saved_posts enable row level security;

create policy "own read saves" on public.saved_posts
for select to authenticated
using (user_id = (select auth.uid()));

create policy "own insert saves" on public.saved_posts
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "own delete saves" on public.saved_posts
for delete to authenticated
using (user_id = (select auth.uid()));
