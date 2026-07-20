-- Phase 5 (slice): managed brands + content attribution
-- Additive only — applied by hand via Supabase MCP to dev project irpayabloogarxwtjmrf.
-- Owner-only this slice (NO RBAC). brand_memberships is shaped for future multi-member
-- but only the owner row exists and is enforced now.
-- Rollback: supabase-dev/phase5-brands-attribution-rollback.sql

create type posting_as_type as enum ('person', 'brand');
create type about_type as enum ('none', 'animal', 'litter', 'product', 'service', 'brand', 'collaboration');
create type brand_type as enum (
  'kennel', 'llc', 'pet_shop', 'product_brand', 'rescue', 'service_provider', 'creator', 'independent_seller'
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_type brand_type not null,
  avatar_url text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- owner-only this slice; unique(brand_id, profile_id) is the multi-member seam
create table public.brand_memberships (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (brand_id, profile_id)
);

-- Attribution columns are nullable/defaulted, so existing rows stay valid as person-authored.
-- about_id is intentionally polymorphic (no FK) — resolves against creatures/etc by about_type.
alter table public.posts
  add column posting_as_type posting_as_type not null default 'person',
  add column brand_id uuid references public.brands(id) on delete set null,
  add column about_type about_type not null default 'none',
  add column about_id uuid;

alter table public.listings
  add column posting_as_type posting_as_type not null default 'person',
  add column brand_id uuid references public.brands(id) on delete set null,
  add column about_type about_type not null default 'none',
  add column about_id uuid;

-- RLS ---------------------------------------------------------------------
alter table public.brands enable row level security;
alter table public.brand_memberships enable row level security;

-- brands are publicly readable (they surface as public attribution, per G1-A)
create policy "public read brands" on public.brands
  for select to anon, authenticated using (true);

-- you may create a brand only as yourself
create policy "own insert brands" on public.brands
  for insert to authenticated with check (owner_id = auth.uid());

-- a member reads only their own membership rows (owner-only this slice).
-- This self-referential shape is what lets the posts/listings insert checks below
-- see the caller's own membership without a security-definer function.
create policy "read own memberships" on public.brand_memberships
  for select to authenticated using (profile_id = auth.uid());

-- you may create a membership only for yourself, only on a brand you own
create policy "own insert memberships" on public.brand_memberships
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.owner_id = auth.uid()
    )
  );

-- Replace the person-only insert policies with attribution-aware ones.
-- Posting as a brand requires an active membership for (auth.uid(), brand_id);
-- posting as a person keeps the original author_id = auth.uid() rule.
drop policy "own insert posts" on public.posts;
create policy "own insert posts" on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      posting_as_type = 'person'
      or (
        posting_as_type = 'brand'
        and brand_id is not null
        and exists (
          select 1 from public.brand_memberships m
          where m.brand_id = posts.brand_id and m.profile_id = auth.uid()
        )
      )
    )
  );

drop policy "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and (
      posting_as_type = 'person'
      or (
        posting_as_type = 'brand'
        and brand_id is not null
        and exists (
          select 1 from public.brand_memberships m
          where m.brand_id = listings.brand_id and m.profile_id = auth.uid()
        )
      )
    )
  );
