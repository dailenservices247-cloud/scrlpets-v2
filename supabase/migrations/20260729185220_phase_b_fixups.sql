-- Phase B fixups — two gaps the build lanes surfaced.
--
-- 1. link_creature_parent only recomputed the CHILD's generation, so a true
--    founder that is only ever a PARENT kept generation NULL / is_founder
--    false forever (the tree derives client-side as a workaround; the data
--    should still be right). Recompute the parent too.
-- 2. Nothing stopped an owner pointing their creature's litter_id at SOMEONE
--    ELSE'S litter (creatures RLS checks creature ownership only). The app
--    layer guards it; the database now does too.

create or replace function public.link_creature_parent(
  target_creature uuid, target_parent uuid, link_type text
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  child record;
  parent record;
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  select * into child from public.creatures where id = target_creature;
  if not found or child.owner_id <> (select auth.uid()) then
    raise exception 'not_your_creature';
  end if;
  select * into parent from public.creatures where id = target_parent;
  if not found then raise exception 'parent_not_found'; end if;
  if parent.owner_id <> (select auth.uid()) then
    raise exception 'parent_not_yours';
  end if;
  if link_type not in ('sire','dam') then raise exception 'bad_parent_type'; end if;
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

  -- Parent first (its founder/generation status feeds the child's math).
  perform public.recompute_creature_generation(target_parent);
  perform public.recompute_creature_generation(target_creature);
end; $fn$;

-- Litter linkage: your creature may only join YOUR litter (or a litter of a
-- brand you manage, matching the litters write policy).
create or replace function public.enforce_creature_litter_ownership()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  l record;
begin
  if new.litter_id is not null
     and (tg_op = 'INSERT' or new.litter_id is distinct from old.litter_id) then
    select * into l from public.litters where id = new.litter_id;
    if not found then raise exception 'litter_not_found'; end if;
    if l.owner_id <> new.owner_id then
      raise exception 'litter_not_yours';
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists creatures_litter_ownership on public.creatures;
create trigger creatures_litter_ownership
before insert or update on public.creatures
for each row execute function public.enforce_creature_litter_ownership();

revoke execute on function public.enforce_creature_litter_ownership() from anon, authenticated, public;
