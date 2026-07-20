-- Slice B — brand-authority propagation (reduced scope).
--
-- Scope note: phase 7 already propagated author-OR-manager rights to the post
-- and listing UPDATE policies and to the post DELETE policy, and the
-- attribution-immutability triggers already exist (F5). So the only real gaps
-- vs the entity-authority spec are:
--   1. posts still HARD-delete (listings already soft-delete) — decision 3
--   2. no brand_content_events audit trail for manager mutations of others' content
-- matrix rows 6-7.

-- 1. Posts join the soft-delete/evidence pattern (mirror listings).
alter table public.posts add column if not exists deleted_at timestamptz;

-- 2. Post deletion flows ONLY through an author-or-manager RPC (mirror
--    soft_delete_managed_listing, phase 7). The direct hard-delete policy goes.
create or replace function public.soft_delete_managed_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.posts as p
     set deleted_at = now()
   where p.id = target_post_id
     and p.deleted_at is null
     and (
       p.author_id = auth.uid()
       or (
         p.posting_as_type = 'brand'
         and p.brand_id is not null
         and public.is_brand_manager(p.brand_id)
       )
     );
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke execute on function public.soft_delete_managed_post(uuid) from anon, public;
grant execute on function public.soft_delete_managed_post(uuid) to authenticated;

drop policy if exists "own or managed brand delete posts" on public.posts;

-- 3. Hide soft-deleted posts at the POLICY level so every read path (feed,
--    profile tabs, post destination, sitemap, the security_invoker unified_feed
--    view) inherits the filter with zero per-query sweeps. Mirror the listings
--    precedent. NULL-safe by construction (deleted_at IS NULL).
drop policy if exists "public read posts" on public.posts;
create policy "public read posts" on public.posts
for select to anon, authenticated
using (deleted_at is null);

-- Also keep the UPDATE policy from letting anyone edit a soft-deleted row.
-- (The existing "own or managed brand update posts" using-clause is
--  author-or-manager; add the deleted_at guard so edits stop after deletion,
--  matching the intent that a removed post is terminal.)
drop policy if exists "own or managed brand update posts" on public.posts;
create policy "own or managed brand update posts" on public.posts
for update to authenticated
using (
  deleted_at is null
  and (
    author_id = (select auth.uid())
    or (
      posting_as_type = 'brand'
      and brand_id is not null
      and public.is_brand_manager(brand_id)
    )
  )
)
with check (
  author_id = (select auth.uid())
  or (
    posting_as_type = 'brand'
    and brand_id is not null
    and public.is_brand_manager(brand_id)
  )
);

-- 4. Append-only audit of manager mutations of OTHERS' brand content.
--    Mirrors brand_membership_events: RLS select for managers, no direct write
--    grants; rows are written only by the security-definer trigger below.
create table if not exists public.brand_content_events (
  id uuid default gen_random_uuid() not null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  content_kind text not null,
  content_id uuid not null,
  action text not null,
  created_at timestamptz default now() not null,
  constraint brand_content_events_pkey primary key (id),
  constraint brand_content_events_kind_check check (content_kind = any (array['post','listing'])),
  constraint brand_content_events_action_check check (action = any (array['edit','delete']))
);

create index if not exists idx_brand_content_events_brand_created
  on public.brand_content_events using btree (brand_id, created_at desc);

alter table public.brand_content_events enable row level security;

create policy "managers read content events" on public.brand_content_events
for select to authenticated
using (public.is_brand_manager(brand_id));

-- No insert/update/delete policy: authenticated cannot write directly.
-- Writes happen only through the security-definer trigger function.

-- Trigger: one function for both tables (kind passed via TG_ARGV). Records an
-- event only when the actor is NOT the author (a manager acting on someone
-- else's content), for brand-attributed rows. Distinguishes edit vs soft-delete
-- by the deleted_at transition. to_jsonb keeps it column-agnostic across the
-- author_id (posts) / seller_id (listings) difference.
create or replace function public.log_brand_content_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  author uuid;
  act text;
  newj jsonb := to_jsonb(NEW);
  oldj jsonb := to_jsonb(OLD);
begin
  if (newj->>'posting_as_type') is distinct from 'brand'
     or (newj->>'brand_id') is null then
    return NEW;
  end if;
  author := coalesce(newj->>'author_id', newj->>'seller_id')::uuid;
  if actor is null or actor is not distinct from author then
    return NEW;
  end if;
  if (oldj->>'deleted_at') is null and (newj->>'deleted_at') is not null then
    act := 'delete';
  else
    act := 'edit';
  end if;
  insert into public.brand_content_events (brand_id, actor_id, content_kind, content_id, action)
  values ((newj->>'brand_id')::uuid, actor, TG_ARGV[0], (newj->>'id')::uuid, act);
  return NEW;
end;
$$;

revoke execute on function public.log_brand_content_event() from anon, authenticated, public;

create or replace trigger posts_brand_content_audit
after update on public.posts
for each row execute function public.log_brand_content_event('post');

create or replace trigger listings_brand_content_audit
after update on public.listings
for each row execute function public.log_brand_content_event('listing');
