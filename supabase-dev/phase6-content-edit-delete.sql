-- Phase 6: owner-only content edit/delete.
-- Posts hard-delete; listings soft-delete. Dev project only.
-- Rollback: supabase-dev/phase6-content-edit-delete-rollback.sql

-- Add edit timestamps without making existing content look edited.
alter table public.posts add column updated_at timestamptz;
alter table public.listings add column updated_at timestamptz;
alter table public.listings add column deleted_at timestamptz;

update public.posts set updated_at = created_at where updated_at is null;
update public.listings set updated_at = created_at where updated_at is null;

alter table public.posts alter column updated_at set default now();
alter table public.posts alter column updated_at set not null;
alter table public.listings alter column updated_at set default now();
alter table public.listings alter column updated_at set not null;

-- Keep updated_at server-owned.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

create trigger listings_touch_updated_at
before update on public.listings
for each row execute function public.touch_updated_at();

-- Identity, attribution, and subject links cannot be rewritten after publish.
-- RLS cannot compare OLD and NEW values, so this invariant belongs in a trigger.
create or replace function public.enforce_content_identity_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'posts' then
    if new.id is distinct from old.id
       or new.author_id is distinct from old.author_id
       or new.content_type is distinct from old.content_type
       or new.tagged_creature_id is distinct from old.tagged_creature_id
       or new.posting_as_type is distinct from old.posting_as_type
       or new.brand_id is distinct from old.brand_id
       or new.about_type is distinct from old.about_type
       or new.about_id is distinct from old.about_id
       or new.created_at is distinct from old.created_at then
      raise exception 'post identity and attribution are immutable';
    end if;
  elsif tg_table_name = 'listings' then
    if new.id is distinct from old.id
       or new.seller_id is distinct from old.seller_id
       or new.creature_id is distinct from old.creature_id
       or new.posting_as_type is distinct from old.posting_as_type
       or new.brand_id is distinct from old.brand_id
       or new.about_type is distinct from old.about_type
       or new.about_id is distinct from old.about_id
       or new.created_at is distinct from old.created_at then
      raise exception 'listing identity and attribution are immutable';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from anon, authenticated, public;
revoke execute on function public.enforce_content_identity_immutable() from anon, authenticated, public;

create trigger posts_identity_immutable
before update on public.posts
for each row execute function public.enforce_content_identity_immutable();

create trigger listings_identity_immutable
before update on public.listings
for each row execute function public.enforce_content_identity_immutable();

-- Owner-only mutations. Server actions also scope by owner as defense in depth.
create policy "own update posts" on public.posts
for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "own update listings" on public.listings
for update to authenticated
using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));

create policy "own delete posts" on public.posts
for delete to authenticated
using (author_id = (select auth.uid()));

-- Soft-deleted listings must not remain directly readable through the table API.
drop policy "public read listings" on public.listings;
create policy "public read listings" on public.listings
for select to anon, authenticated
using (deleted_at is null);

-- Preserve all phase5d columns and append updated_at for the Edited marker.
create or replace view public.unified_feed with (security_invoker = on) as
  select p.id, 'post'::text as kind, p.content_type::text as subtype, p.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id as creature_id, c.name as creature_name, c.slug as creature_slug, c.avatar_url as creature_avatar,
         p.body as title, p.media_url, p.created_at,
         p.posting_as_type::text as posting_as_type, p.brand_id,
         b.name as brand_name, b.avatar_url as brand_avatar,
         b.slug as brand_slug,
         p.updated_at
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.creatures c on c.id = p.tagged_creature_id
    left join public.brands b on b.id = p.brand_id
  union all
  select l.id, 'listing'::text, null, l.seller_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id, c.name, c.slug, c.avatar_url,
         l.title, l.media_url, l.created_at,
         l.posting_as_type::text, l.brand_id,
         b.name, b.avatar_url,
         b.slug,
         l.updated_at
    from public.listings l
    join public.profiles pr on pr.id = l.seller_id
    left join public.creatures c on c.id = l.creature_id
    left join public.brands b on b.id = l.brand_id
   where l.deleted_at is null
  union all
  select pm.id, 'promo'::text, null, pm.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         null::uuid, null, null, null,
         pm.title, pm.media_url, pm.created_at,
         'person'::text, null::uuid,
         null::text, null::text,
         null::text,
         pm.created_at
    from public.promos pm
    join public.profiles pr on pr.id = pm.author_id;

grant select on public.unified_feed to anon, authenticated;
