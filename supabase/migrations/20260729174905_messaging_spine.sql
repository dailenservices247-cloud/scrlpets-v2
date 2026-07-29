-- Phase A.6 — messaging spine (grill Q9): message-requests gate, image
-- attachments, reactions, read-state. Typing indicators deliberately absent
-- (Synergy-era; ephemeral presence owns no data here).
--
-- v2 conversations are a canonical user_a/user_b pair with no participants
-- table, so per-conversation state lands on the conversation row and
-- per-user read state gets its own small table.

-- ============================================================ REQUEST GATE
-- A cold DM (no pack link, no inquiry context) arrives as a REQUEST: the
-- initiator can write their opener(s), the addressee sees a request inbox
-- and accepts or declines. Inquiry-created conversations and pack pairs are
-- born active — an inquiry IS a legitimate knock; packmates knock freely.
alter table public.conversations
  add column if not exists status text not null default 'active',
  add column if not exists initiated_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz;

do $$ begin
  alter table public.conversations add constraint conversations_status_check
    check (status in ('active','request','declined'));
exception when duplicate_object then null; end $$;

create index if not exists idx_conversations_request_inbox
  on public.conversations using btree (user_b, status) where status = 'request';
create index if not exists idx_conversations_request_inbox_a
  on public.conversations using btree (user_a, status) where status = 'request';

-- The addressee (the participant who did NOT initiate) resolves a request.
create or replace function public.resolve_message_request(
  target_conversation uuid, accept boolean
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  conv record;
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  select * into conv from public.conversations where id = target_conversation;
  if conv is null then raise exception 'not_found'; end if;
  if (select auth.uid()) not in (conv.user_a, conv.user_b) then
    raise exception 'not_a_party';
  end if;
  if (select auth.uid()) = conv.initiated_by then
    raise exception 'initiator_cannot_resolve';
  end if;
  if conv.status <> 'request' then raise exception 'not_a_request'; end if;
  update public.conversations
     set status = case when accept then 'active' else 'declined' end,
         accepted_at = case when accept then now() else null end
   where id = target_conversation;
end; $fn$;

revoke execute on function public.resolve_message_request(uuid, boolean) from anon, public;
grant execute on function public.resolve_message_request(uuid, boolean) to authenticated;

-- Message sends respect the gate: initiator may write into a pending
-- request (the knock itself); nobody writes into a declined thread; active
-- threads behave as today. RESTRICTIVE so it ANDs onto the existing
-- participant + block insert policy instead of replacing it.
create policy "request gate on message send" on public.messages
as restrictive for insert to authenticated
with check (
  exists (
    select 1 from public.conversations conv
    where conv.id = messages.conversation_id
      and (
        conv.status = 'active'
        or (conv.status = 'request' and conv.initiated_by = (select auth.uid()))
      )
  )
);

-- =========================================================== ATTACHMENTS
-- One image per message (day-one scope), EXIF-stripped client-side through
-- the shared upload util before it ever reaches storage.
alter table public.messages
  add column if not exists media_url text;

-- ============================================================= REACTIONS
create table if not exists public.message_reactions (
  id uuid default gen_random_uuid() not null,
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now() not null,
  constraint message_reactions_pkey primary key (id),
  constraint message_reactions_one_per_user unique (message_id, profile_id),
  constraint message_reactions_emoji_check check (emoji in ('❤️','😂','😮','😢','👍','🐾'))
);

alter table public.message_reactions enable row level security;

-- Participants of the conversation read reactions; each user owns their one
-- reaction per message.
create policy "participants read reactions" on public.message_reactions
for select to authenticated
using (
  exists (
    select 1 from public.messages m
    join public.conversations conv on conv.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (select auth.uid()) in (conv.user_a, conv.user_b)
  )
);

create policy "own react" on public.message_reactions
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversations conv on conv.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (select auth.uid()) in (conv.user_a, conv.user_b)
  )
);

create policy "own change reaction" on public.message_reactions
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "own remove reaction" on public.message_reactions
for delete to authenticated
using (profile_id = (select auth.uid()));

-- ============================================================= READ STATE
-- The data primitive Scrlpets must OWN for the future Synergy unified inbox
-- (satellites own their data; the shell renders it). Receipts UI is
-- off-switchable per profile; the read-state row still updates either way —
-- the switch governs DISPLAY of your read state to others.
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  constraint conversation_reads_pkey primary key (conversation_id, profile_id)
);

alter table public.conversation_reads enable row level security;

create policy "participants read read-state" on public.conversation_reads
for select to authenticated
using (
  exists (
    select 1 from public.conversations conv
    where conv.id = conversation_reads.conversation_id
      and (select auth.uid()) in (conv.user_a, conv.user_b)
  )
);

create policy "own upsert read-state" on public.conversation_reads
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.conversations conv
    where conv.id = conversation_reads.conversation_id
      and (select auth.uid()) in (conv.user_a, conv.user_b)
  )
);

create policy "own update read-state" on public.conversation_reads
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

alter table public.profiles
  add column if not exists show_read_receipts boolean not null default true;
