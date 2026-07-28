-- GROUPS — breed and species communities. Deliberately NOT general forums.
--
-- SCOPE LOCK (Dailen): a group is one breed or one species — "German
-- Shepherds", "Bearded Dragons". Not "Off topic", not "Buy & Sell", not a
-- town. General-purpose groups turn a marketplace into a free-for-all that
-- needs its own moderation staff, and Scrlpets runs exactly one moderation
-- queue.
--
-- THE ONE STRUCTURAL DECISION, and the reason this migration is short: a group
-- post is a ROW IN public.posts carrying a group_id. Not a group_posts table.
-- A post row already inherits reporting (content_reports.target_kind = 'post'),
-- the resolve_report hide path, soft delete, reactions, comments, the
-- suspension RESTRICTIVE gate, the attribution-immutability trigger and the
-- author-or-manager edit rules. A parallel table would have been a second
-- place to forget every one of those, and content_reports could not even name
-- it — its CHECK allows only ('post','listing','profile','comment'). One
-- nullable column buys the entire Phase 3 moderation surface for free.

-- ================================================================= CATALOGUE
create table if not exists public.groups (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  -- NOT NULL on purpose: species is the scope tag. A group with no species is
  -- not a breed group, and the column is what keeps the surface honest.
  -- Free text, same vocabulary as creatures.species.
  species text not null,
  description text,
  created_at timestamptz default now() not null,
  constraint groups_pkey primary key (id),
  constraint groups_slug_unique unique (slug)
);
create index if not exists idx_groups_species
  on public.groups using btree (species, name);

alter table public.groups enable row level security;

-- Split by role, and the anon policy references NO function. `anon` has no
-- EXECUTE on is_platform_admin(), and Postgres checks function permission when
-- the policy is evaluated instead of short-circuiting the OR — that exact
-- shape made every anonymous read of public.guides fail with 42501 and render
-- an empty state indistinguishable from having no rows (20260728170702).
-- Nothing here is draftable, so both roles simply read everything.
create policy "public read groups" on public.groups
for select to anon, authenticated using (true);

-- No client INSERT/UPDATE/DELETE policy for any role. The catalogue is curated
-- through the definer below, because open group creation is how a
-- breed-scoped surface becomes a general forum overnight — and it is the
-- cheapest spam vector on the site.
create or replace function public.upsert_group(
  group_slug text, group_name text, group_species text, group_description text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare gid uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if coalesce(trim(group_species), '') = '' then raise exception 'species_required'; end if;
  insert into public.groups (slug, name, species, description)
  values (group_slug, group_name, group_species, group_description)
  on conflict (slug) do update
    set name = excluded.name,
        species = excluded.species,
        description = excluded.description
  returning id into gid;
  return gid;
end; $fn$;
revoke execute on function public.upsert_group(text, text, text, text) from anon, public;
grant execute on function public.upsert_group(text, text, text, text) to authenticated;

-- ================================================================ MEMBERSHIP
create table if not exists public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now() not null,
  constraint group_memberships_pkey primary key (group_id, profile_id)
);
-- The PK covers group -> members; this covers "which groups am I in".
create index if not exists idx_group_memberships_profile
  on public.group_memberships using btree (profile_id);

alter table public.group_memberships enable row level security;

-- Membership is public: the member count is the group's only social proof, and
-- "who else keeps this breed" is the whole point of the surface.
create policy "public read group memberships" on public.group_memberships
for select to anon, authenticated using (true);

create policy "own join group" on public.group_memberships
for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "own leave group" on public.group_memberships
for delete to authenticated
using (profile_id = (select auth.uid()));

-- No UPDATE policy: joined_at is not a member-editable field.
--
-- ponytail: no "suspended cannot join" RESTRICTIVE policy. Suspension gates
-- PUBLISHING, and posts already carries that gate — a suspended account that
-- joins a group still cannot say a word in it. Follows are treated the same
-- way today. Add one the moment membership grants anything beyond read.

-- ========================================================== POSTS GET A LENS
-- ON DELETE SET NULL, not CASCADE: retiring a group must not delete member
-- content. The post survives as an ordinary post with its moderation history
-- intact, which is the same reasoning as soft-deleting posts instead of
-- hard-deleting them.
alter table public.posts
  add column if not exists group_id uuid references public.groups(id) on delete set null;

-- Partial: the overwhelming majority of posts will never belong to a group.
create index if not exists idx_posts_group
  on public.posts using btree (group_id, created_at desc)
  where group_id is not null;

-- Only a member may put a post in a group. RESTRICTIVE so it ANDs onto the
-- existing "own insert posts" policy rather than replacing it — brand
-- attribution and the suspension gate stay exactly as they are.
create policy "group posts require membership" on public.posts
as restrictive for insert to authenticated
with check (
  group_id is null
  or exists (
    select 1 from public.group_memberships m
    where m.group_id = posts.group_id
      and m.profile_id = (select auth.uid())
  )
);

-- The same check on UPDATE, because enforce_content_identity_immutable freezes
-- author/brand/creature attribution but knows nothing about group_id. Without
-- this, a member of one group could edit an existing post's group_id and
-- inject it into a group they never joined — the membership gate would hold on
-- the way in and leak on the way past.
--
-- ponytail: this also means leaving a group blocks editing the posts you left
-- behind. That reads as correct, and the alternative is a second BEFORE UPDATE
-- trigger for one column. Add the trigger if editing-after-leaving is wanted.
--
-- `using (true)` is spelled out rather than omitted: a RESTRICTIVE policy ANDs,
-- so this adds no row restriction, and being explicit removes any doubt about
-- how an absent USING clause is treated on an UPDATE policy. Getting that wrong
-- silently would block every post edit on the site.
create policy "group posts require membership on update" on public.posts
as restrictive for update to authenticated
using (true)
with check (
  group_id is null
  or exists (
    select 1 from public.group_memberships m
    where m.group_id = posts.group_id
      and m.profile_id = (select auth.uid())
  )
);

-- ====================================================================== SEED
-- Four real breeds/species across mammal, reptile and bird, so a fresh
-- database never shows an empty surface and the scope is legible from the
-- first screen: every row is an animal, not a topic.
insert into public.groups (slug, name, species, description) values
  ('german-shepherds', 'German Shepherds', 'Dog',
   'Working lines, show lines, and the hip and temperament questions every GSD owner ends up asking.'),
  ('maine-coons', 'Maine Coons', 'Cat',
   'Coat care, growth curves, and the HCM screening every responsible Maine Coon breeder tests for.'),
  ('bearded-dragons', 'Bearded Dragons', 'Reptile',
   'Basking temperatures, UVB, brumation and diet — the husbandry that decides whether a beardie thrives.'),
  ('budgerigars', 'Budgerigars', 'Bird',
   'Flock keeping, cage setup and the seed-versus-pellet argument, from people who actually keep budgies.')
on conflict (slug) do nothing;
