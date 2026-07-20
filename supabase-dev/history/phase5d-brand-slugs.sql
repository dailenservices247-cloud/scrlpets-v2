-- Phase 5d: immutable brand slugs + slug in unified_feed (for clickable attribution).
-- Applied via MCP 2026-07-01.

alter table public.brands add column slug text;

update public.brands
set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || left(id::text, 4)
where slug is null;

alter table public.brands alter column slug set not null;
alter table public.brands add constraint brands_slug_unique unique (slug);

create or replace view public.unified_feed with (security_invoker = on) as
  select p.id, 'post'::text as kind, p.content_type::text as subtype, p.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id as creature_id, c.name as creature_name, c.slug as creature_slug, c.avatar_url as creature_avatar,
         p.body as title, p.media_url, p.created_at,
         p.posting_as_type::text as posting_as_type, p.brand_id,
         b.name as brand_name, b.avatar_url as brand_avatar,
         b.slug as brand_slug
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
         b.slug
    from public.listings l
    join public.profiles pr on pr.id = l.seller_id
    left join public.creatures c on c.id = l.creature_id
    left join public.brands b on b.id = l.brand_id
  union all
  select pm.id, 'promo'::text, null, pm.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         null::uuid, null, null, null,
         pm.title, pm.media_url, pm.created_at,
         'person'::text, null::uuid,
         null::text, null::text,
         null::text
    from public.promos pm
    join public.profiles pr on pr.id = pm.author_id;
