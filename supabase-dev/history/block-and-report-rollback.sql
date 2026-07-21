-- Rollback for 20260721185454_block_and_report. Documentation only.

drop policy if exists "msg participant insert" on public.messages;
create policy "msg participant insert" on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
  )
);

drop function if exists public.block_user(uuid);
drop function if exists public.unblock_user(uuid);
drop function if exists public.is_blocked_between(uuid, uuid);
drop table if exists public.content_reports;
drop table if exists public.blocks;
drop function if exists public.blocked_profile_ids();
