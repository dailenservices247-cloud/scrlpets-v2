-- Every readable column on creatures is actually granted. Rolled back.
--
-- creatures is the one table in this schema with NO table-wide SELECT grant:
-- 20260801174832 revoked it so anchor_value could be withheld, and replaced it
-- with an explicit column allow-list. That migration's own comment names the
-- standing cost: "any column added to creatures in future is invisible to
-- clients until someone grants it deliberately".
--
-- It then happened. in_roster (20260906204600) shipped with the column and its
-- index and no grant, which would have failed EVERY read it was added to fix —
-- Postgres checks column SELECT privilege on any column a query references, a
-- WHERE clause included, so a filter on an ungranted column raises 42501 even
-- when nothing selects it. The same comment records the inverse mistake
-- shipping twice before. Three for three on a rule that only lives in a
-- comment, so it lives here now instead.
--
-- Deliberately withheld columns are listed once, below. Adding a column to that
-- list is a decision someone has to write down; forgetting a grant is not.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  withheld constant text[] := array['anchor_value'];
  missing  text;
  n        integer;
begin
  ------------------------------------- 1. the premise: no table-wide SELECT
  -- If someone ever re-grants SELECT table-wide, the allow-list stops filtering
  -- anything and anchor_value leaks. That is a bigger failure than a missing
  -- grant, so it is checked first.
  select count(*) into n
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'creatures'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if n <> 0 then
    raise exception 'PROBE FAILED: table-wide SELECT on creatures is back (% grants); the column allow-list no longer filters anything', n;
  end if;
  insert into probe_out (msg) values ('1 no table-wide SELECT on creatures');

  --------------------------------- 2. every non-withheld column is granted
  select string_agg(c.column_name || ':' || r.role, ', ' order by c.column_name, r.role)
    into missing
    from information_schema.columns c
   cross join (values ('anon'), ('authenticated')) as r(role)
   where c.table_schema = 'public' and c.table_name = 'creatures'
     and not (c.column_name = any (withheld))
     and not exists (
       select 1 from information_schema.column_privileges p
        where p.table_schema = 'public' and p.table_name = 'creatures'
          and p.column_name = c.column_name
          and p.grantee = r.role
          and p.privilege_type = 'SELECT'
     );
  if missing is not null then
    raise exception 'PROBE FAILED: creatures columns readable by nobody — add a grant in the migration that added them: %', missing;
  end if;
  insert into probe_out (msg) values ('2 every non-withheld creatures column is SELECT-granted');

  ------------------------- 3. the withheld ones are still actually withheld
  -- Proves 2 discriminates. If every column were granted, 2 would pass
  -- vacuously and the allow-list would be doing no work at all.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'creatures'
     and column_name = any (withheld)
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if n <> 0 then
    raise exception 'PROBE FAILED: a withheld creatures column is readable (% grants)', n;
  end if;
  insert into probe_out (msg) values ('3 withheld columns still withheld');

  ------------------------------ 4. the live read, as the role that does it
  -- The catalog says the grant exists; this says a query can use it. Both,
  -- because a catalog row has been wrong about a working query before.
  perform set_config('role', 'anon', true);
  perform id from public.creatures where in_roster = true limit 1;
  perform set_config('role', 'postgres', true);
  insert into probe_out (msg) values ('4 anon can filter on in_roster');
end $probe$;

select msg from probe_out;
rollback;
