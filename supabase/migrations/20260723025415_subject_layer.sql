-- Slice C — the subject layer (mechanism a + scope A, Dailen 2026-07-23).
-- Census: about_id was NEVER used (0 rows); animals already reference through
-- real FK columns (tagged_creature_id / creature_id). So: FKs stay THE animal
-- mechanism, about_* serves non-animal subjects with hard existence validation,
-- and litters/services become real referenceable entities (locked decision 4).
-- Collaboration leaves the enum entirely (locked decision 5 — planning bank).

-- 1. Minimal subject entities (name-only creation this slice).
create table if not exists public.litters (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz default now() not null,
  constraint litters_pkey primary key (id)
);
create index if not exists idx_litters_owner on public.litters using btree (owner_id);
create index if not exists idx_litters_brand on public.litters using btree (brand_id);

create table if not exists public.services (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz default now() not null,
  constraint services_pkey primary key (id)
);
create index if not exists idx_services_owner on public.services using btree (owner_id);
create index if not exists idx_services_brand on public.services using btree (brand_id);

alter table public.litters enable row level security;
alter table public.services enable row level security;

create policy "public read litters" on public.litters
for select to anon, authenticated using (true);
create policy "own insert litters" on public.litters
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (brand_id is null or public.is_brand_manager(brand_id))
);

create policy "public read services" on public.services
for select to anon, authenticated using (true);
create policy "own insert services" on public.services
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (brand_id is null or public.is_brand_manager(brand_id))
);

-- 2. Normalize the only stray data: 6 idless 'animal' labels (their real
--    animal reference already lives in the FK column). about_type is guarded
--    by the identity-immutability triggers — disable them for exactly this
--    sanctioned normalization.
alter table public.listings disable trigger listings_identity_immutable;
alter table public.posts disable trigger posts_identity_immutable;
update public.listings set about_type = 'none' where about_type = 'animal';
update public.posts set about_type = 'none' where about_type = 'animal';
alter table public.listings enable trigger listings_identity_immutable;
alter table public.posts enable trigger posts_identity_immutable;

-- 3. Shrink the enum: drop 'animal' (FK is the animal mechanism) and
--    'collaboration' (banked). Enum value removal = type swap.
alter type public.about_type rename to about_type_old;
create type public.about_type as enum ('none', 'product', 'brand', 'litter', 'service');
alter table public.posts alter column about_type drop default;
alter table public.posts
  alter column about_type type public.about_type using about_type::text::public.about_type;
alter table public.posts alter column about_type set default 'none';
alter table public.listings alter column about_type drop default;
alter table public.listings
  alter column about_type type public.about_type using about_type::text::public.about_type;
alter table public.listings alter column about_type set default 'none';
drop type public.about_type_old;

-- 4. No composer path (or any client) can reference a subject that doesn't
--    exist: DB-authoritative existence check on insert. Updates to about_*
--    are already refused by the identity-immutability triggers.
create or replace function public.enforce_subject_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.about_type = 'none' then
    new.about_id := null;
    return new;
  end if;
  if new.about_id is null then
    raise exception 'subject_required';
  end if;
  if new.about_type = 'brand' then
    if not exists (select 1 from public.brands where id = new.about_id) then
      raise exception 'subject_invalid';
    end if;
  elsif new.about_type = 'product' then
    if not exists (select 1 from public.promos where id = new.about_id) then
      raise exception 'subject_invalid';
    end if;
  elsif new.about_type = 'litter' then
    if not exists (select 1 from public.litters where id = new.about_id) then
      raise exception 'subject_invalid';
    end if;
  elsif new.about_type = 'service' then
    if not exists (select 1 from public.services where id = new.about_id) then
      raise exception 'subject_invalid';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_subject_exists() from anon, authenticated, public;

create trigger posts_subject_exists
before insert on public.posts
for each row execute function public.enforce_subject_exists();

create trigger listings_subject_exists
before insert on public.listings
for each row execute function public.enforce_subject_exists();
