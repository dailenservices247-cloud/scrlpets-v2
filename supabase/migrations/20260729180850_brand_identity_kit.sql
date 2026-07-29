-- Phase B.2 — brand identity kit + business profile fields (grill Q12, V1-11/V1-14).
--
-- Honest enrichment inside the Brand House system: tagline, established date,
-- philosophy/years/specialties, and a manager-curated facility gallery
-- (≤12 photos). NO theme colors (Q12: platform-controlled palette). Legacy's
-- self-claimed achievement chips stay dead.

alter table public.brands
  add column if not exists tagline text,
  add column if not exists founded_on date,
  add column if not exists philosophy text,
  add column if not exists years_experience integer,
  add column if not exists specialties text[];

do $$ begin
  alter table public.brands add constraint brands_tagline_check
    check (tagline is null or length(btrim(tagline)) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.brands add constraint brands_years_check
    check (years_experience is null or years_experience between 0 and 100);
exception when duplicate_object then null; end $$;

-- Brands had no general UPDATE policy (identity fields were definer-managed;
-- banner/avatar went through their own path). Managers may edit the kit
-- fields; slug/owner stay frozen by the existing immutability discipline.
do $$ begin
  create policy "managers update brand kit" on public.brands
  for update to authenticated
  using (public.is_brand_manager(id))
  with check (public.is_brand_manager(id));
exception when duplicate_object then null; end $$;

-- Until now brands had NO update policy at all — that absence was the
-- enforcement for slug/owner immutability and the definer-only restrict
-- flag. The new policy therefore ships WITH column-level privileges: revoke
-- the blanket table UPDATE and grant back only the editable columns (a
-- column carve-OUT of a table-level grant isn't a thing in Postgres).
-- Definer functions run owner-privileged and keep their paths (restrict
-- flag stays definer-only).
revoke update on table public.brands from authenticated;
grant update (name, brand_type, avatar_url, banner_url, tagline, founded_on,
              philosophy, years_experience, specialties)
  on table public.brands to authenticated;

create table if not exists public.brand_gallery (
  id uuid default gen_random_uuid() not null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  photo_url text not null,
  caption text,
  display_order integer not null default 0,
  created_at timestamptz default now() not null,
  constraint brand_gallery_pkey primary key (id),
  constraint brand_gallery_caption_check
    check (caption is null or length(caption) <= 150)
);
create index if not exists idx_brand_gallery_brand
  on public.brand_gallery using btree (brand_id, display_order);

alter table public.brand_gallery enable row level security;

create policy "public read brand gallery" on public.brand_gallery
for select to anon, authenticated using (true);

-- Manager writes, capped at 12 photos per brand at the database.
create policy "managers insert gallery" on public.brand_gallery
for insert to authenticated
with check (
  public.is_brand_manager(brand_id)
  and (select count(*) from public.brand_gallery g
        where g.brand_id = brand_gallery.brand_id) < 12
);

create policy "managers update gallery" on public.brand_gallery
for update to authenticated
using (public.is_brand_manager(brand_id))
with check (public.is_brand_manager(brand_id));

create policy "managers delete gallery" on public.brand_gallery
for delete to authenticated
using (public.is_brand_manager(brand_id));
