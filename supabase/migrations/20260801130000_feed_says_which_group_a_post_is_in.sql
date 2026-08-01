-- A group post is a row in public.posts carrying a group_id, and the SELECT
-- policy on posts is `using (deleted_at is null)` with no group condition. That
-- is deliberate — groups are PUBLIC breed communities and discovery is their
-- whole point — but it means a post made into "German Shepherds" appears in
-- every visitor's home feed with nothing saying where it came from, while its
-- author is redirected to the group timeline and never sees it happen.
--
-- The visibility is correct. The silence is the bug, and the feed cannot fix it
-- because `unified_feed` does not carry group_id at all.
--
-- Three columns appended to a three-branch UNION ALL:
--
--   * APPENDED, never inserted. `create or replace view` may only add columns
--     at the end of the list and may not retype or rename an existing one. Any
--     other edit shape fails outright, which is the one safe property of this
--     statement — the view backs the home feed.
--   * `with (security_invoker='on')` is restated. It is a view option, not a
--     property of the query, and a replace that omits it silently reverts the
--     view to definer semantics — every RLS policy on posts, listings, promos
--     and profiles would then be evaluated as the view owner. Grants and the
--     three existing indexes are unaffected by a replace.
--   * slug and name ride along rather than group_id alone, because a chip that
--     cannot be clicked is not much better than no chip: /groups/[slug] keys on
--     the slug and the label needs the name. It is the same LEFT JOIN shape the
--     brand columns already use, against a table whose SELECT policy is
--     `using (true)` for anon and authenticated, so no row disappears — and
--     LEFT JOIN means that even if that ever changed, the post would still
--     render with a null group rather than dropping out of the feed.
create or replace view public.unified_feed with (security_invoker='on') as
 select p.id,
    'post'::text as kind,
    p.content_type::text as subtype,
    p.author_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    c.id as creature_id,
    c.name as creature_name,
    c.slug as creature_slug,
    c.avatar_url as creature_avatar,
    p.body as title,
    p.media_url,
    p.created_at,
    p.posting_as_type::text as posting_as_type,
    p.brand_id,
    b.name as brand_name,
    b.avatar_url as brand_avatar,
    b.slug as brand_slug,
    p.updated_at,
    p.group_id,
    g.slug as group_slug,
    g.name as group_name
   from posts p
     join profiles pr on pr.id = p.author_id
     left join creatures c on c.id = p.tagged_creature_id
     left join brands b on b.id = p.brand_id
     left join groups g on g.id = p.group_id
union all
 select l.id,
    'listing'::text as kind,
    null::text as subtype,
    l.seller_id as author_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    c.id as creature_id,
    c.name as creature_name,
    c.slug as creature_slug,
    c.avatar_url as creature_avatar,
    l.title,
    l.media_url,
    l.created_at,
    l.posting_as_type::text as posting_as_type,
    l.brand_id,
    b.name as brand_name,
    b.avatar_url as brand_avatar,
    b.slug as brand_slug,
    l.updated_at,
    null::uuid as group_id,
    null::text as group_slug,
    null::text as group_name
   from listings l
     join profiles pr on pr.id = l.seller_id
     left join creatures c on c.id = l.creature_id
     left join brands b on b.id = l.brand_id
  where l.deleted_at is null
union all
 select pm.id,
    'promo'::text as kind,
    null::text as subtype,
    pm.author_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    null::uuid as creature_id,
    null::text as creature_name,
    null::text as creature_slug,
    null::text as creature_avatar,
    pm.title,
    pm.media_url,
    pm.created_at,
    'person'::text as posting_as_type,
    null::uuid as brand_id,
    null::text as brand_name,
    null::text as brand_avatar,
    null::text as brand_slug,
    pm.created_at as updated_at,
    null::uuid as group_id,
    null::text as group_slug,
    null::text as group_name
   from promos pm
     join profiles pr on pr.id = pm.author_id;
