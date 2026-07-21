-- Block + report (follows/block/report lane, sub-slice 2). Block hides from
-- feed + DMs and severs follows; blocked user's profile stays viewable (MVP —
-- full content-hiding is a banked block-privacy pass). Report is append-only.

-- ── Blocks ──────────────────────────────────────────────────────────────────
-- A block is PRIVATE to the blocker (no public read — who-blocked-whom is a
-- harassment/enumeration vector). Rows are written only via block_user().
create table if not exists public.blocks (
  id uuid default gen_random_uuid() not null,
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  constraint blocks_pkey primary key (id),
  constraint blocks_unique_pair unique (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists idx_blocks_blocker on public.blocks using btree (blocker_id);
create index if not exists idx_blocks_blocked on public.blocks using btree (blocked_id);

alter table public.blocks enable row level security;

-- The blocker reads only their OWN blocks. No other read; no direct write.
create policy "own read blocks" on public.blocks
for select to authenticated
using (blocker_id = (select auth.uid()));

-- Is there a block in EITHER direction between two users? Security-definer so the
-- message policy can consult blocks it otherwise can't read.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from anon, public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Block: record it AND sever both follow edges (the reverse edge needs definer
-- because RLS delete is follower_id = auth.uid() only).
create or replace function public.block_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'auth_required'; end if;
  if me = target_id then raise exception 'cannot_block_self'; end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (me, target_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.follows
   where (follower_id = me and following_id = target_id)
      or (follower_id = target_id and following_id = me);

  return true;
end;
$$;

revoke execute on function public.block_user(uuid) from anon, public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocks
   where blocker_id = auth.uid() and blocked_id = target_id;
  return true;
end;
$$;

revoke execute on function public.unblock_user(uuid) from anon, public;
grant execute on function public.unblock_user(uuid) to authenticated;

-- Extend the message-insert gate: participant AND not blocked in either
-- direction. Recreate the phase-4 policy with the block check appended.
drop policy if exists "msg participant insert" on public.messages;
create policy "msg participant insert" on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
      and not public.is_blocked_between(
        c.user_a,
        c.user_b
      )
  )
);

-- ── Reports ─────────────────────────────────────────────────────────────────
-- Append-only. Reporter inserts + reads own; nobody updates/deletes. Moderation
-- review is a banked admin surface.
create table if not exists public.content_reports (
  id uuid default gen_random_uuid() not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_kind text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz default now() not null,
  constraint content_reports_pkey primary key (id),
  constraint content_reports_kind_check check (target_kind = any (array['post','listing','profile'])),
  constraint content_reports_reason_check check (reason = any (array['spam','harassment','scam','inappropriate','other']))
);

create index if not exists idx_content_reports_reporter on public.content_reports using btree (reporter_id);
create index if not exists idx_content_reports_target on public.content_reports using btree (target_kind, target_id);

alter table public.content_reports enable row level security;

create policy "own insert reports" on public.content_reports
for insert to authenticated
with check (reporter_id = (select auth.uid()));

create policy "own read reports" on public.content_reports
for select to authenticated
using (reporter_id = (select auth.uid()));
-- No update/delete policy: reports are append-only evidence.
