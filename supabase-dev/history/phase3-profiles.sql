-- Phase 3: profile bio + owner update policy
alter table public.profiles add column if not exists bio text;

create policy "own update profiles" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
