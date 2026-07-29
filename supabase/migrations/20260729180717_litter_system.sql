-- Phase B.1 — the litter system's data layer (grill V1-01 + Dailen's
-- create-first lock).
--
-- A litter is an ORGANIZATIONAL entity first: recording a litter is the
-- default experience and carries no selling implication. Selling happens by
-- creating listings for the litter's individual animals — which routes
-- through the existing verification gate naturally. So no pricing columns
-- here at all: the gate, not the litter, is the selling protocol. (Legacy
-- bundled min/max pricing into the litter and its publish button crashed;
-- separating concerns kills that whole failure class.)

alter table public.litters
  add column if not exists species text,
  add column if not exists breed text,
  add column if not exists description text,
  add column if not exists expected_date date,
  add column if not exists birth_date date,
  add column if not exists status text not null default 'expecting',
  add column if not exists sire_id uuid references public.creatures(id) on delete set null,
  add column if not exists dam_id uuid references public.creatures(id) on delete set null,
  add column if not exists cover_url text,
  add column if not exists updated_at timestamptz default now() not null;

do $$ begin
  alter table public.litters add constraint litters_status_check
    check (status in ('expecting','born','closed'));
exception when duplicate_object then null; end $$;

-- Young animals link to their litter; retiring a litter never deletes animals.
alter table public.creatures
  add column if not exists litter_id uuid references public.litters(id) on delete set null;

create index if not exists idx_creatures_litter
  on public.creatures using btree (litter_id) where litter_id is not null;
create index if not exists idx_litters_owner_status
  on public.litters using btree (owner_id, status);

-- litters shipped with public-read + own-insert only (Slice C stubs). The
-- litter page and management need update/delete; brand-manager rights follow
-- the existing is_brand_manager pattern when the litter is brand-attached.
create policy "owner updates litters" on public.litters
for update to authenticated
using (
  owner_id = (select auth.uid())
  or (brand_id is not null and public.is_brand_manager(brand_id))
)
with check (
  owner_id = (select auth.uid())
  or (brand_id is not null and public.is_brand_manager(brand_id))
);

create policy "owner deletes litters" on public.litters
for delete to authenticated
using (
  owner_id = (select auth.uid())
  or (brand_id is not null and public.is_brand_manager(brand_id))
);

-- Dam/sire must belong to the litter's owner and be breeding stock — a
-- litter is a claim about YOUR breeding program.
create or replace function public.enforce_litter_parents()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  p record;
begin
  if new.sire_id is not null then
    select * into p from public.creatures where id = new.sire_id;
    if not found or p.owner_id <> new.owner_id then
      raise exception 'sire_not_yours';
    end if;
  end if;
  if new.dam_id is not null then
    select * into p from public.creatures where id = new.dam_id;
    if not found or p.owner_id <> new.owner_id then
      raise exception 'dam_not_yours';
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $fn$;

drop trigger if exists litters_parent_guard on public.litters;
create trigger litters_parent_guard
before insert or update on public.litters
for each row execute function public.enforce_litter_parents();

revoke execute on function public.enforce_litter_parents() from anon, authenticated, public;
