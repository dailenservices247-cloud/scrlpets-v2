-- Scrlpets v2 slice-1 dev schema (dev project only — NOT legacy prod)
-- G1-A lock: feed is publicly readable (anon) — see kickoff-design §2.6.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- creatures = the navigator/identity (satellite pattern)
create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text,
  slug text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create type content_type as enum ('post','reel','long_video');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content_type content_type not null default 'post',
  body text,
  media_url text,
  tagged_creature_id uuid references public.creatures(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  price_cents integer not null,
  media_url text,
  creature_id uuid references public.creatures(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  media_url text,
  created_at timestamptz not null default now()
);

-- Unified feed: one creature-aware source the RSC reads.
-- security_invoker so RLS on base tables is evaluated as the querying role, not the view owner.
create view public.unified_feed with (security_invoker = on) as
  select p.id, 'post'::text as kind, p.content_type::text as subtype, p.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id as creature_id, c.name as creature_name, c.slug as creature_slug, c.avatar_url as creature_avatar,
         p.body as title, p.media_url, p.created_at
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.creatures c on c.id = p.tagged_creature_id
  union all
  select l.id, 'listing'::text, null, l.seller_id,
         pr.username, pr.display_name, pr.avatar_url,
         c.id, c.name, c.slug, c.avatar_url,
         l.title, l.media_url, l.created_at
    from public.listings l
    join public.profiles pr on pr.id = l.seller_id
    left join public.creatures c on c.id = l.creature_id
  union all
  select pm.id, 'promo'::text, null, pm.author_id,
         pr.username, pr.display_name, pr.avatar_url,
         null::uuid, null, null, null,
         pm.title, pm.media_url, pm.created_at
    from public.promos pm
    join public.profiles pr on pr.id = pm.author_id;

-- RLS: read-only feed is PUBLIC (G1-A); writes come later with their own policies.
alter table public.profiles enable row level security;
alter table public.creatures enable row level security;
alter table public.posts enable row level security;
alter table public.listings enable row level security;
alter table public.promos enable row level security;
create policy "public read profiles"  on public.profiles  for select to anon, authenticated using (true);
create policy "public read creatures" on public.creatures for select to anon, authenticated using (true);
create policy "public read posts"     on public.posts     for select to anon, authenticated using (true);
create policy "public read listings"  on public.listings  for select to anon, authenticated using (true);
create policy "public read promos"    on public.promos    for select to anon, authenticated using (true);

-- auto-create a profile on signup
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email,'@',1) || '_' || left(new.id::text,4), split_part(new.email,'@',1));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
