-- Slice 2: media bucket + write policies
-- Public read stays per G1-A; writes owner-enforced at the DB even if server actions are bypassed.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- uploads land at media/<uid>/<filename>; only the owner can write their folder
create policy "media owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- content writes: author/owner must be the session user
create policy "own insert posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid());

create policy "own insert listings" on public.listings
  for insert to authenticated with check (seller_id = auth.uid());

create policy "own insert creatures" on public.creatures
  for insert to authenticated with check (owner_id = auth.uid());
