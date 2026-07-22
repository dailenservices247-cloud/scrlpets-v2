-- Deleted comments remain readable as tombstones so a deleted root that has
-- replies stays in the thread as a "[deleted]" placeholder (option a). Safe:
-- deleteComment blanks the body, so no deleted content leaves the DB. The app
-- query drops deleted comments that have no replies.
drop policy if exists "public read comments" on public.comments;
create policy "public read comments" on public.comments
for select to anon, authenticated
using (true);
