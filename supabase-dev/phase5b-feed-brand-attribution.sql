-- Phase 5b: surface brand attribution in the unified feed.
-- create or replace keeps the first 14 columns identical (name/type/order) and
-- appends 4 brand columns; promos carry nulls (no attribution). security_invoker
-- preserved so base-table RLS still evaluates as the querying role.

create or replace view public.unified_feed with (security_invoker = on) as
  select p.id, 'post'::text as kind, p.content_type::text as subtype, p.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id as creature_id, c.name as creature_name, c.slug as creature_slug, c.avatar_url as creature_avatar,
         p.body as title, p.media_url, p.created_at,
         p.posting_as_type::text as posting_as_type, p.brand_id,
         b.name as brand_name, b.avatar_url as brand_avatar
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
         b.name, b.avatar_url
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
         null::text, null::text
    from public.promos pm
    join public.profiles pr on pr.id = pm.author_id;
