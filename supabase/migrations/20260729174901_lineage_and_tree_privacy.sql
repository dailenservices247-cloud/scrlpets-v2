-- Phase A.2 — lineage edges, generations, founders, tree privacy (grill Q6, V1-03).
--
-- The tree's data model. Legacy computed generation client-side and wrote an
-- edge table; the computation moves into a definer here so no client can
-- hand-set generational facts. Founder = parentless breeding stock (legacy's
-- "only first two" cap was an accident of its seeding, not a rule worth
-- keeping).

create table if not exists public.creature_lineage (
  id uuid default gen_random_uuid() not null,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  parent_id uuid not null references public.creatures(id) on delete cascade,
  parent_type text not null,
  created_at timestamptz default now() not null,
  constraint creature_lineage_pkey primary key (id),
  constraint creature_lineage_parent_type_check check (parent_type in ('sire','dam')),
  constraint creature_lineage_one_per_type unique (creature_id, parent_type),
  constraint creature_lineage_not_self check (creature_id <> parent_id)
);
create index if not exists idx_creature_lineage_parent
  on public.creature_lineage using btree (parent_id);

alter table public.creature_lineage enable row level security;

-- Lineage visibility follows the CHILD creature's visibility (legacy leaked
-- less than it showed here — family viewers saw animals but not links; ours
-- is consistent: see the creature => see its parent links).
create policy "read lineage of visible creatures" on public.creature_lineage
for select to anon, authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = creature_lineage.creature_id
      and (c.page_visible = true or c.owner_id = (select auth.uid()))
  )
);

-- generation: max(parent generation) + 1, else 1. is_founder derives from
-- having no parent links AND being breeding stock.
alter table public.creatures
  add column if not exists generation integer,
  add column if not exists is_founder boolean not null default false;

create or replace function public.recompute_creature_generation(target_creature uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  parent_gen integer;
  has_parents boolean;
begin
  select max(coalesce(p.generation, 1)), count(*) > 0
    into parent_gen, has_parents
    from public.creature_lineage l
    join public.creatures p on p.id = l.parent_id
   where l.creature_id = target_creature;

  update public.creatures
     set generation = case when has_parents then coalesce(parent_gen, 1) + 1 else 1 end,
         is_founder = (not has_parents) and creature_role = 'breeding'
   where id = target_creature;
end; $fn$;

-- Writes only through definers — generation math must be DB-authoritative, so
-- no direct client insert/update/delete policy exists on the edge table.
create or replace function public.link_creature_parent(
  target_creature uuid, target_parent uuid, link_type text
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  child record;
  parent record;
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  select * into child from public.creatures where id = target_creature;
  if child is null or child.owner_id <> (select auth.uid()) then
    raise exception 'not_your_creature';
  end if;
  select * into parent from public.creatures where id = target_parent;
  if parent is null then raise exception 'parent_not_found'; end if;
  -- Owner links within their own animals; cross-owner lineage (stud litters)
  -- arrives with the banked breeding-commerce era, not silently.
  if parent.owner_id <> (select auth.uid()) then
    raise exception 'parent_not_yours';
  end if;
  if link_type not in ('sire','dam') then raise exception 'bad_parent_type'; end if;
  -- Cycle guard: the parent may not be a descendant of the child.
  if exists (
    with recursive descendants as (
      select creature_id from public.creature_lineage where parent_id = target_creature
      union
      select l.creature_id from public.creature_lineage l
      join descendants d on l.parent_id = d.creature_id
    )
    select 1 from descendants where creature_id = target_parent
  ) then raise exception 'lineage_cycle'; end if;

  insert into public.creature_lineage (creature_id, parent_id, parent_type)
  values (target_creature, target_parent, link_type)
  on conflict (creature_id, parent_type) do update set parent_id = excluded.parent_id;

  perform public.recompute_creature_generation(target_creature);
end; $fn$;

create or replace function public.unlink_creature_parent(
  target_creature uuid, link_type text
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  if not exists (
    select 1 from public.creatures c
    where c.id = target_creature and c.owner_id = (select auth.uid())
  ) then raise exception 'not_your_creature'; end if;
  delete from public.creature_lineage
   where creature_id = target_creature and parent_type = link_type;
  perform public.recompute_creature_generation(target_creature);
end; $fn$;

revoke execute on function public.recompute_creature_generation(uuid) from anon, authenticated, public;
revoke execute on function public.link_creature_parent(uuid, uuid, text) from anon, public;
grant execute on function public.link_creature_parent(uuid, uuid, text) to authenticated;
revoke execute on function public.unlink_creature_parent(uuid, text) from anon, public;
grant execute on function public.unlink_creature_parent(uuid, text) to authenticated;

-- Tree privacy lives on the OPERATOR (profiles), not the brand — the tree is
-- operator-scoped (R16). public: anyone. buyers: pack-linked buyers (door 2).
-- private: owner only. Enforced at the tree read surface; creature-page
-- visibility stays governed by page_visible (A.1) so the two dials compose.
alter table public.profiles
  add column if not exists tree_privacy text not null default 'public';

do $$ begin
  alter table public.profiles add constraint profiles_tree_privacy_check
    check (tree_privacy in ('public','buyers','private'));
exception when duplicate_object then null; end $$;
