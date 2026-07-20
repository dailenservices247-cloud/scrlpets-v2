-- Rollback for migration 20260720181712_brand_authority_posts_softdelete_audit.
-- Documentation only — never auto-applied (repo precedent). Restores the
-- pre-Slice-B post policies (author-or-manager hard delete, unfiltered read).

drop trigger if exists posts_brand_content_audit on public.posts;
drop trigger if exists listings_brand_content_audit on public.listings;
drop function if exists public.log_brand_content_event();

drop table if exists public.brand_content_events;

drop function if exists public.soft_delete_managed_post(uuid);

-- Restore the phase-7 post UPDATE policy (author-or-manager, no deleted_at guard).
drop policy if exists "own or managed brand update posts" on public.posts;
create policy "own or managed brand update posts" on public.posts
for update to authenticated
using (
  author_id = (select auth.uid())
  or (posting_as_type = 'brand' and brand_id is not null and public.is_brand_manager(brand_id))
)
with check (
  author_id = (select auth.uid())
  or (posting_as_type = 'brand' and brand_id is not null and public.is_brand_manager(brand_id))
);

-- Restore the phase-7 hard-delete policy.
drop policy if exists "own or managed brand delete posts" on public.posts;
create policy "own or managed brand delete posts" on public.posts
for delete to authenticated
using (
  author_id = (select auth.uid())
  or (posting_as_type = 'brand' and brand_id is not null and public.is_brand_manager(brand_id))
);

-- Restore the unfiltered read policy.
drop policy if exists "public read posts" on public.posts;
create policy "public read posts" on public.posts
for select to anon, authenticated
using (true);

alter table public.posts drop column if exists deleted_at;
