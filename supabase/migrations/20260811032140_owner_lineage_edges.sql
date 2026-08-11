-- The tree fetched lineage with `.in("creature_id", <every id the owner has>)`,
-- which built a request URL from the whole herd — about 15KB at 400 animals and
-- growing. When that request failed the caller destructured `{ data }` and
-- dropped the error, so edges became null, `?? []` read as "this owner has no
-- lineage at all", and EVERY animal collapsed to generation 1. A breeder with a
-- few hundred animals saw their family tree flattened into one row, confidently,
-- with nothing reporting a problem.
--
-- An embedded PostgREST filter would fix the URL but not safely: creature_lineage
-- has TWO foreign keys into creatures (creature_id and parent_id), so the embed
-- is ambiguous and needs a constraint name to disambiguate — which this codebase
-- already avoids on purpose, because a renamed constraint breaks it silently.
--
-- So: a function. Constant-size call, no embed ambiguity, no constraint-name
-- coupling, one round trip.
--
-- SECURITY INVOKER deliberately. Lineage visibility should keep following the
-- caller's RLS exactly as the previous query did; this is a shape change, not a
-- permission change.

create or replace function public.owner_lineage_edges(target_owner uuid)
returns table (creature_id uuid, parent_id uuid, parent_type text)
language sql stable security invoker set search_path = public as $fn$
  select l.creature_id, l.parent_id, l.parent_type
    from public.creature_lineage l
    join public.creatures c on c.id = l.creature_id
   where c.owner_id = target_owner
     and c.archived_at is null;
$fn$;
revoke execute on function public.owner_lineage_edges(uuid) from public;
grant execute on function public.owner_lineage_edges(uuid) to anon, authenticated;
