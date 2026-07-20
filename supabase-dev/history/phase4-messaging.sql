-- Phase 4: messaging
-- 1:1 conversations + append-only messages. Append-only = trust-log seam for phase 5 (G7).
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conv_order check (user_a < user_b),  -- canonical pair order → (a,b)==(b,a)
  unique (user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conv_created on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conv participant read" on public.conversations
  for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "conv participant insert" on public.conversations
  for insert to authenticated with check (auth.uid() in (user_a, user_b));

create policy "msg participant read" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
create policy "msg participant insert" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
-- NO update/delete policy → append-only.

alter publication supabase_realtime add table public.messages;
