-- The media bucket and the realtime publication, neither of which was ever in
-- source control.
--
-- Same root cause as the auth.users trigger: `storage` and the realtime
-- publication live outside the `public` schema, so schema dumps skip them.
-- Both existed only inside the original database, created by hand through the
-- dashboard, and both were missing from the fresh project.
--
-- What was broken on the new database until this ran:
--   * Every image and video upload — avatars, post media, listing photos.
--     The bucket simply did not exist.
--   * Live chat. Without the publication, messages only appear on refresh.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

-- Uploads are namespaced by user id: a member may only write into a folder
-- named after their own uid. Reads are open because the bucket is public.
drop policy if exists "media owner upload" on storage.objects;
create policy "media owner upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Realtime for the messages table, so a conversation updates without a reload.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when others then null;
end $$;
