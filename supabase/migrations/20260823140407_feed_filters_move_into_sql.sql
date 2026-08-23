-- The feed stops naming every followed and blocked profile in a URL.
--
-- getFeed built two PostgREST filters from unbounded arrays — `.in(author_id,
-- [...followed])` and `.not(author_id, in, (...blocked))` — and PostgREST puts
-- both in the query string. A UUID plus separator is ~37 bytes, so the request
-- line runs out near 430 ids at 16KB and near 210 at 8KB.
--
-- The BLOCK list is the worse of the two and is the one nobody wrote down: the
-- follow filter only applies to the Following tab, while the block filter runs
-- on every feed request for every signed-in viewer. Its overflow does not
-- degrade Following, it breaks the feed.
--
-- Same failure this repo already shipped once as a8f35a0, "the composer stops
-- asking for 409 brands by name".

-- Guests read the feed, and a security-invoker function calling a definer needs
-- EXECUTE on it as the caller — so without this, every guest request would fail
-- on the permission check rather than on anything to do with blocks.
--
-- Safe: blocked_profile_ids() is keyed entirely on auth.uid(), which is NULL for
-- anon, so an anonymous caller gets zero rows. It exposes no one's block list;
-- it exposes an empty set. The original revoke was the file-level hygiene this
-- codebase applies to every function, not a decision about this one.
grant execute on function public.blocked_profile_ids() to anon;

-- SECURITY INVOKER, deliberately and load-bearingly. `unified_feed` is itself
-- declared with (security_invoker='on'), so RLS is evaluated as the caller. A
-- DEFINER here would return every row of the feed to everyone — including
-- guests, including soft-deleted rows — and it would look like it worked,
-- because every feed test asserts that rows are PRESENT rather than absent.
create or replace function public.feed_rows(
  following_only boolean default false,
  hide_fixtures boolean default false,
  max_rows integer default 200
)
returns setof public.unified_feed
language sql
stable
security invoker
set search_path = public
as $fn$
  select f.*
    from public.unified_feed f
   where
     -- NULL-safe: `not like` alone is NULL-eliminating and would drop
     -- caption-less media posts from the production feed.
     (not hide_fixtures or f.title is null or f.title not like 'E2E %')
     and not exists (
       select 1 from public.blocked_profile_ids() b
        where b.profile_id = f.author_id
     )
     and (
       not following_only
       or f.author_id = (select auth.uid())
       or exists (
         select 1 from public.follows fo
          where fo.follower_id = (select auth.uid())
            and fo.following_id = f.author_id
       )
     )
   order by f.created_at desc
   limit greatest(1, least(max_rows, 500));
$fn$;

-- RLS on unified_feed is what decides what a guest actually sees, exactly as it
-- did before this migration. The grant only says who may ask.
grant execute on function public.feed_rows(boolean, boolean, integer) to anon, authenticated;
