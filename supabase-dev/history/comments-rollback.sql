-- Rollback for 20260722051614_comments. Documentation only.
alter table public.content_reports drop constraint if exists content_reports_kind_check;
alter table public.content_reports add constraint content_reports_kind_check
  check (target_kind = any (array['post','listing','profile']));
drop trigger if exists comments_immutable on public.comments;
drop function if exists public.enforce_comment_immutable();
drop table if exists public.comments;

-- read-all rollback
drop policy if exists "public read comments" on public.comments;
create policy "public read comments" on public.comments for select to anon, authenticated using (deleted_at is null);
