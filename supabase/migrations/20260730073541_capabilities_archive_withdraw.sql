-- Phase B.5 — brand capabilities (R2), creature archive (R8), withdrawal
-- window (R9).
--
-- R2 finishes the June functionality matrix: "Brand OS should be
-- capability-based, not only type-based... presets configure initial modules,
-- but operators can add capabilities later." The brand TYPE seeds the initial
-- capability set; the set itself is what Brand OS renders modules from.

alter table public.brands
  add column if not exists capabilities text[] not null default '{}';

-- The vocabulary is deliberately small — each entry must map to a real module
-- that exists or is queued, or it is decoration.
do $$ begin
  alter table public.brands add constraint brands_capabilities_check
    check (capabilities <@ array[
      'breeding',        -- litters, program surfaces
      'selling_animals', -- animal listings under the verification gate
      'products',        -- shop inventory
      'services',        -- service listings
      'adoption',        -- rehoming + applications
      'content'          -- creator/education tooling
    ]::text[]);
exception when duplicate_object then null; end $$;

-- Type → initial capabilities. `llc` deliberately gets NONE: the locked
-- decision is that an LLC is a legal wrapper, not a dashboard type, so its
-- operator picks capabilities explicitly.
create or replace function public.default_capabilities_for(t public.brand_type)
returns text[] language sql immutable as $fn$
  select case t
    when 'kennel' then array['breeding','selling_animals']
    when 'pet_shop' then array['products']
    when 'product_brand' then array['products']
    when 'rescue' then array['adoption']
    when 'service_provider' then array['services']
    when 'creator' then array['content']
    when 'independent_seller' then array['selling_animals']
    else array[]::text[]
  end;
$fn$;

-- Seed existing brands (idempotent: only ones still at the empty default).
update public.brands
   set capabilities = public.default_capabilities_for(brand_type)
 where capabilities = '{}';

-- New brands inherit their type's preset unless the caller supplied a set.
create or replace function public.seed_brand_capabilities()
returns trigger language plpgsql as $fn$
begin
  if new.capabilities is null or new.capabilities = '{}' then
    new.capabilities := public.default_capabilities_for(new.brand_type);
  end if;
  return new;
end; $fn$;

drop trigger if exists brands_seed_capabilities on public.brands;
create trigger brands_seed_capabilities
before insert on public.brands
for each row execute function public.seed_brand_capabilities();

revoke execute on function public.seed_brand_capabilities() from anon, authenticated, public;
grant update (capabilities) on table public.brands to authenticated;

-- ============================================================ R8: ARCHIVE
-- Creatures are referenced by lineage edges, litters, listings, alumni,
-- breeding events, genetic tests and posts. Hard delete would orphan or
-- cascade real history, so removal is an ARCHIVE: hidden from every surface
-- including the owner's own roster and every picker, referenced rows intact.
alter table public.creatures
  add column if not exists archived_at timestamptz;

create or replace function public.archive_creature(target_creature uuid, archived boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  update public.creatures
     set archived_at = case when archived then now() else null end,
         -- Archiving also pulls the public page; unarchiving does NOT silently
         -- republish it — that stays the owner's separate, deliberate choice.
         page_visible = case when archived then false else page_visible end
   where id = target_creature and owner_id = (select auth.uid());
  if not found then raise exception 'not_your_creature'; end if;
end; $fn$;

revoke execute on function public.archive_creature(uuid, boolean) from anon, public;
grant execute on function public.archive_creature(uuid, boolean) to authenticated;

-- The narrow escape hatch: hard delete ONLY when nothing references the row.
-- This is the "I typed this animal into existence by mistake" case, not a way
-- to erase history.
create or replace function public.delete_creature_if_unreferenced(target_creature uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  if not exists (
    select 1 from public.creatures
     where id = target_creature and owner_id = (select auth.uid())
  ) then raise exception 'not_your_creature'; end if;

  if exists (select 1 from public.creature_lineage
              where creature_id = target_creature or parent_id = target_creature)
     or exists (select 1 from public.litters
                 where sire_id = target_creature or dam_id = target_creature)
     or exists (select 1 from public.creatures where litter_id is not null and id = target_creature)
     or exists (select 1 from public.listings where creature_id = target_creature)
     or exists (select 1 from public.alumni where creature_id = target_creature)
     or exists (select 1 from public.breeding_events
                 where creature_id = target_creature or partner_creature_id = target_creature)
     or exists (select 1 from public.genetic_tests where creature_id = target_creature)
     or exists (select 1 from public.posts where tagged_creature_id = target_creature)
  then
    raise exception 'creature_referenced';
  end if;

  delete from public.creatures where id = target_creature;
end; $fn$;

revoke execute on function public.delete_creature_if_unreferenced(uuid) from anon, public;
grant execute on function public.delete_creature_if_unreferenced(uuid) to authenticated;

-- Archived creatures leave public view entirely (owner keeps access so the
-- archive is reversible from their own surfaces).
drop policy if exists "public read visible creatures" on public.creatures;
create policy "public read visible creatures" on public.creatures
for select to anon, authenticated
using (
  (page_visible = true and archived_at is null)
  or owner_id = (select auth.uid())
);

-- ========================================================== R9: WITHDRAWAL
-- An application is an inquiry until someone confirms handover. The buyer may
-- withdraw while it is submitted OR accepted, provided NEITHER party has
-- confirmed; from the first confirmation it is transaction evidence and locks.
create or replace function public.set_application_status(
  target_application uuid, new_status text
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  a record;
begin
  select * into a from public.buyer_applications where id = target_application;
  if not found then raise exception 'not_found'; end if;

  if uid = a.buyer_id then
    if new_status <> 'withdrawn' then raise exception 'buyer_may_only_withdraw'; end if;
    if a.status not in ('submitted','accepted') then raise exception 'already_decided'; end if;
    if a.buyer_confirmed_at is not null or a.seller_confirmed_at is not null then
      raise exception 'handover_started';
    end if;
  elsif uid = a.seller_id then
    if new_status not in ('accepted','declined') then raise exception 'invalid_decision'; end if;
    if a.status <> 'submitted' then raise exception 'already_decided'; end if;
  else
    raise exception 'not_a_party';
  end if;

  update public.buyer_applications
     set status = new_status, decided_at = now(), decided_by = uid
   where id = target_application;
end; $fn$;

revoke execute on function public.set_application_status(uuid, text) from anon, public;
grant execute on function public.set_application_status(uuid, text) to authenticated;
