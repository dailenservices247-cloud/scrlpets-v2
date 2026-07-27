-- Phase 1 / R10: account deletion requests.
-- Deleting an auth user needs service-role privileges the client deliberately
-- does not hold, so a request is recorded here and completed by the admin
-- queue (R6). One open request per person.

create table if not exists public.account_deletion_requests (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested',
  requested_at timestamptz default now() not null,
  completed_at timestamptz,
  constraint account_deletion_requests_pkey primary key (id),
  constraint account_deletion_requests_one_open unique (profile_id),
  constraint account_deletion_requests_status_check
    check (status = any (array['requested', 'completed', 'cancelled']))
);

alter table public.account_deletion_requests enable row level security;

-- Owner-only: you can request your own deletion and see your own request.
-- No update/delete policy — only the admin path (definer) resolves a request.
create policy "own read deletion requests" on public.account_deletion_requests
for select to authenticated
using (profile_id = (select auth.uid()));

create policy "own insert deletion requests" on public.account_deletion_requests
for insert to authenticated
with check (profile_id = (select auth.uid()));
