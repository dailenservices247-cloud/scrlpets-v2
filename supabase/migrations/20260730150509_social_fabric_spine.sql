-- Phase D spine. Deliberately small: Phase A already shipped pack_links,
-- alumni, message_reactions, conversation_reads, conversations.status,
-- messages.media_url and profiles.show_read_receipts, and notifications
-- already has read_at plus SELECT/UPDATE/DELETE policies — so pack UI,
-- pup-dates, message requests, reactions, receipts, mark-all-read and
-- clear-all are all UI work over existing schema. Only four gaps remain.
--
-- Pup-dates get NO new table: a pup-date is a post about a creature, and
-- posts already carry tagged_creature_id + about_type/about_id. The alumni
-- row is what makes the timeline two-sided.

-- 1. Pin to profile. Nullable timestamp rather than a boolean so the profile
-- can order several pinned posts deterministically; null means unpinned.
alter table public.posts
  add column if not exists pinned_at timestamptz;

create index if not exists idx_posts_pinned
  on public.posts (author_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

-- 2. Per-post comment toggle. Defaults true so nothing already posted changes.
alter table public.posts
  add column if not exists comments_enabled boolean not null default true;

-- 3. Animal story highlights.
--
-- Media lives in a text[] with a CHECK on array_length rather than a child
-- table with a row cap. That is a deliberate choice: a per-parent row cap is
-- exactly what produced the 42P17 recursion class fixed in 20260730095309 and
-- 20260730101120, because the cap has to count the guarded table from inside
-- its own policy. A column CHECK cannot recurse.
create table if not exists public.creature_highlights (
  id uuid default gen_random_uuid() not null,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  title text not null,
  media_urls text[] not null default '{}',
  created_at timestamptz default now() not null,
  constraint creature_highlights_pkey primary key (id),
  constraint creature_highlights_title_check
    check (length(title) between 1 and 60),
  constraint creature_highlights_media_check
    check (array_length(media_urls, 1) is null or array_length(media_urls, 1) <= 10)
);

create index if not exists idx_creature_highlights_creature
  on public.creature_highlights (creature_id, created_at desc);

alter table public.creature_highlights enable row level security;

-- Readable exactly as far as the animal's own page is: an archived or hidden
-- creature takes its highlights with it.
create policy "read highlights of visible creatures" on public.creature_highlights
for select to anon, authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = creature_highlights.creature_id
      and c.archived_at is null
      and c.page_visible
  )
);

-- Write authority follows the animal's owner, and the owner can still manage
-- highlights on a creature they have hidden from the public page.
create policy "owner inserts highlights" on public.creature_highlights
for insert to authenticated
with check (
  exists (
    select 1 from public.creatures c
    where c.id = creature_highlights.creature_id
      and c.owner_id = (select auth.uid())
  )
);

create policy "owner updates highlights" on public.creature_highlights
for update to authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = creature_highlights.creature_id
      and c.owner_id = (select auth.uid())
  )
);

create policy "owner deletes highlights" on public.creature_highlights
for delete to authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = creature_highlights.creature_id
      and c.owner_id = (select auth.uid())
  )
);

-- 4. Guides surfaced per group, for the group health-guide tab. Nullable:
-- a guide with no group stays a general guide.
alter table public.guides
  add column if not exists group_id uuid references public.groups(id) on delete set null;

create index if not exists idx_guides_group
  on public.guides (group_id)
  where group_id is not null;
