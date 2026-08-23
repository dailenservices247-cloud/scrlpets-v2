-- Brands become removable. They never were.
--
-- `brands` has had no DELETE policy and no archived_at since the baseline, so
-- every brand ever created is permanent and publicly visible forever. That is
-- what produced a8f35a0 — the composer naming 409 brands in a URL — because
-- fixture brands accumulate with nothing able to remove them.
--
-- ARCHIVE, NOT DELETE. Brand slugs are immutable, and posts, listings,
-- memberships and the append-only brand_content_events audit spine all
-- reference the brand. A hard delete orphans the evidence; the parity ledger
-- names immutable attribution as a confirmed strength to protect. Same call
-- already made for posts and listings.
--
-- Mirrors archive_creature (20260730073541) rather than inventing a second
-- shape for the same idea.

alter table public.brands
  add column if not exists archived_at timestamptz;

create or replace function public.archive_brand(target_brand uuid, archived boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); b record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into b from public.brands where id = target_brand;
  if b is null then raise exception 'not_found'; end if;
  -- Owner only. Archiving removes the brand's public identity, which is a
  -- stronger act than editing it, and admins can already do everything else.
  if uid <> b.owner_id then raise exception 'not_the_owner'; end if;

  update public.brands
     set archived_at = case when archived then now() else null end
   where id = target_brand;
end; $fn$;

revoke execute on function public.archive_brand(uuid, boolean) from anon, public;
grant execute on function public.archive_brand(uuid, boolean) to authenticated;

-- REPLACED, not added. Permissive policies are ORed together, so a second
-- SELECT policy would make archived brands MORE visible, not less. The owner
-- keeps reading their own archived brand or unarchiving is unreachable.
drop policy if exists "public read brands" on public.brands;
create policy "public read brands" on public.brands
  for select to authenticated, anon
  using (archived_at is null or owner_id = (select auth.uid()));
