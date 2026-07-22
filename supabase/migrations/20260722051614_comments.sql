-- Comments (comments/reactions/saves lane, sub-slice 2 — closes the social lane).
-- Threaded one level, soft-delete, block-hiding via the query, reportable.

create table if not exists public.comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint comments_pkey primary key (id)
);

create index if not exists idx_comments_post on public.comments using btree (post_id, created_at);
create index if not exists idx_comments_parent on public.comments using btree (parent_id);

alter table public.comments enable row level security;

-- Non-deleted comments are public; the app query additionally excludes authors
-- in the viewer's block union (same pattern as the feed).
create policy "public read comments" on public.comments
for select to anon, authenticated
using (deleted_at is null);

create policy "own insert comments" on public.comments
for insert to authenticated
with check (author_id = (select auth.uid()));

create policy "own update comments" on public.comments
for update to authenticated
using (deleted_at is null and author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "own delete comments" on public.comments
for delete to authenticated
using (author_id = (select auth.uid()));

-- Keep identity/threading immutable across edits (only body/updated_at may change).
create or replace function public.enforce_comment_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.author_id is distinct from old.author_id
     or new.post_id is distinct from old.post_id
     or new.parent_id is distinct from old.parent_id then
    raise exception 'comment identity is immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger comments_immutable
before update on public.comments
for each row execute function public.enforce_comment_immutable();

-- Comments become a report target.
alter table public.content_reports drop constraint if exists content_reports_kind_check;
alter table public.content_reports add constraint content_reports_kind_check
  check (target_kind = any (array['post','listing','profile','comment']));
