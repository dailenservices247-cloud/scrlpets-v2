-- Published guides were invisible to logged-out visitors.
--
-- The original policy was `published_at is not null OR is_platform_admin()`
-- for both anon and authenticated. `anon` has no EXECUTE on
-- is_platform_admin (correctly — it is an admin predicate), and Postgres
-- checks function permission when the policy is evaluated rather than relying
-- on OR short-circuiting. So EVERY anonymous read of the table failed with
-- 42501 "permission denied for function is_platform_admin", and the page fell
-- back to its empty state.
--
-- The failure was silent in the worst way: the query returned an error, the
-- query helper coalesced it to [], and the surface rendered "No guides
-- published yet" — indistinguishable from genuinely having none. It survived
-- an acceptance test that asserted the page renders, because the empty state
-- IS a valid render.
--
-- Fix: split by role so anon never references the function at all. An
-- anonymous visitor only ever needs published rows; only an admin needs the
-- draft case, and admins are always authenticated.

drop policy if exists "public read published guides" on public.guides;

create policy "anon reads published guides" on public.guides
for select to anon
using (published_at is not null);

create policy "members read published guides and admins read drafts" on public.guides
for select to authenticated
using (published_at is not null or public.is_platform_admin());
