-- F5 / punch list A16: react to comments (founder direction unbanks this).
-- Mirrors post_reactions: one active reaction per user per comment, 6-set.
create table if not exists public.comment_reactions (
  id uuid default gen_random_uuid() not null,
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now() not null,
  constraint comment_reactions_pkey primary key (id),
  constraint comment_reactions_one_per_user unique (comment_id, user_id),
  constraint comment_reactions_type_check
    check (reaction_type = any (array['like','love','laugh','wow','sad','strong']))
);

create index if not exists idx_comment_reactions_comment
  on public.comment_reactions using btree (comment_id);

alter table public.comment_reactions enable row level security;

create policy "public read comment reactions" on public.comment_reactions
for select to anon, authenticated
using (true);

create policy "own insert comment reactions" on public.comment_reactions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "own update comment reactions" on public.comment_reactions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "own delete comment reactions" on public.comment_reactions
for delete to authenticated
using (user_id = (select auth.uid()));
