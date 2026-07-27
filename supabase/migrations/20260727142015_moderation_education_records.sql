-- Phase 3 — moderation (D4), education (D5), trusted animal records v1 (D6).

-- =========================================================== 1. MODERATION (D4)
-- content_reports already exists (block/report slice). Add the resolution path:
-- an audited admin decision that can hide content or suspend an account.

alter table public.content_reports
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution text;

-- Admins can see the queue (reporters already see their own reports).
drop policy if exists "admins read all reports" on public.content_reports;
create policy "admins read all reports" on public.content_reports
for select to authenticated using (public.is_platform_admin());

create table if not exists public.moderation_actions (
  id uuid default gen_random_uuid() not null,
  report_id uuid references public.content_reports(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_kind text,
  target_id uuid,
  notes text,
  created_at timestamptz default now() not null,
  constraint moderation_actions_pkey primary key (id),
  constraint moderation_actions_action_check check (
    action = any (array['dismissed','content_hidden','account_suspended','account_unsuspended'])
  )
);
alter table public.moderation_actions enable row level security;
-- Append-only: definer writes, admins read. No update/delete policy ever.
create policy "admins read moderation actions" on public.moderation_actions
for select to authenticated using (public.is_platform_admin());

-- Suspension is a profile-level flag set only by the definer below.
alter table public.profiles
  add column if not exists suspended_at timestamptz;

create or replace function public.is_suspended(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = target_profile and suspended_at is not null);
$$;
revoke execute on function public.is_suspended(uuid) from anon, public;
grant execute on function public.is_suspended(uuid) to authenticated;

-- The single moderation entry point. Every decision writes an append-only
-- action row, so "who hid this and why" is always answerable.
create or replace function public.resolve_report(
  target_report uuid, decision text, notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if decision not in ('dismissed','content_hidden','account_suspended') then
    raise exception 'invalid_decision';
  end if;
  select * into r from public.content_reports where id = target_report;
  if r is null then raise exception 'not_found'; end if;

  if decision = 'content_hidden' then
    if r.target_kind = 'post' then
      update public.posts set deleted_at = now() where id = r.target_id and deleted_at is null;
    elsif r.target_kind = 'listing' then
      update public.listings set deleted_at = now() where id = r.target_id and deleted_at is null;
    elsif r.target_kind = 'comment' then
      update public.comments set body = '', deleted_at = now()
       where id = r.target_id and deleted_at is null;
    end if;
  elsif decision = 'account_suspended' then
    -- For a profile report the target IS the account; for content, suspend its author.
    if r.target_kind = 'profile' then
      update public.profiles set suspended_at = now() where id = r.target_id;
    elsif r.target_kind = 'post' then
      update public.profiles set suspended_at = now()
       where id = (select author_id from public.posts where id = r.target_id);
    elsif r.target_kind = 'listing' then
      update public.profiles set suspended_at = now()
       where id = (select seller_id from public.listings where id = r.target_id);
    elsif r.target_kind = 'comment' then
      update public.profiles set suspended_at = now()
       where id = (select author_id from public.comments where id = r.target_id);
    end if;
  end if;

  update public.content_reports
     set status = 'resolved', resolved_by = uid, resolved_at = now(), resolution = decision
   where id = target_report;

  insert into public.moderation_actions (report_id, actor_id, action, target_kind, target_id, notes)
  values (target_report, uid, decision, r.target_kind, r.target_id, notes);
end; $$;
revoke execute on function public.resolve_report(uuid, text, text) from anon, public;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;

-- A suspended account cannot publish. RESTRICTIVE so it ANDs onto the existing
-- policies instead of replacing them (brand/manager rules stay untouched).
create policy "suspended cannot post" on public.posts
as restrictive for insert to authenticated
with check (not public.is_suspended((select auth.uid())));

create policy "suspended cannot comment" on public.comments
as restrictive for insert to authenticated
with check (not public.is_suspended((select auth.uid())));

create policy "suspended cannot list" on public.listings
as restrictive for insert to authenticated
with check (not public.is_suspended((select auth.uid())));

-- ============================================================ 2. EDUCATION (D5)
-- Claude drafts; nothing is public until Dailen publishes it.
create table if not exists public.guides (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  summary text,
  body text not null,
  audience text not null default 'owner',
  published_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint guides_pkey primary key (id),
  constraint guides_slug_unique unique (slug),
  constraint guides_audience_check check (audience = any (array['owner','breeder','buyer']))
);
create index if not exists idx_guides_published
  on public.guides using btree (audience, published_at desc);

alter table public.guides enable row level security;
-- Public reads PUBLISHED guides only; admins see drafts too.
create policy "public read published guides" on public.guides
for select to anon, authenticated
using (published_at is not null or public.is_platform_admin());
-- No client write policy: guides are authored/published through the definer.

create or replace function public.upsert_guide(
  guide_slug text, guide_title text, guide_summary text,
  guide_body text, guide_audience text, publish boolean default false
)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  insert into public.guides (slug, title, summary, body, audience, published_at)
  values (guide_slug, guide_title, guide_summary, guide_body, guide_audience,
          case when publish then now() else null end)
  on conflict (slug) do update
    set title = excluded.title, summary = excluded.summary, body = excluded.body,
        audience = excluded.audience, updated_at = now(),
        published_at = case when publish then coalesce(public.guides.published_at, now()) else null end
  returning id into gid;
  return gid;
end; $$;
revoke execute on function public.upsert_guide(text, text, text, text, text, boolean) from anon, public;
grant execute on function public.upsert_guide(text, text, text, text, text, boolean) to authenticated;

-- ================================================ 3. ANIMAL RECORDS v1 (D6)
-- Owner-declared, CLEARLY LABELLED as such. The vet-attested slot exists but
-- stays empty until the vet-partner pilot — no fabricated trust badges.
create table if not exists public.animal_records (
  creature_id uuid not null references public.creatures(id) on delete cascade,
  vaccinations_declared text,
  health_notes_declared text,
  pedigree_notes_declared text,
  birth_date_declared date,
  -- Reserved for the vet pilot. Only a definer path may ever set these.
  vet_attested_by uuid references public.profiles(id) on delete set null,
  vet_attested_at timestamptz,
  updated_at timestamptz default now() not null,
  constraint animal_records_pkey primary key (creature_id)
);
alter table public.animal_records enable row level security;
create policy "public read animal records" on public.animal_records
for select to anon, authenticated using (true);
create policy "owner writes animal records" on public.animal_records
for insert to authenticated
with check (exists (
  select 1 from public.creatures c
  where c.id = animal_records.creature_id and c.owner_id = (select auth.uid())
));
create policy "owner updates animal records" on public.animal_records
for update to authenticated
using (exists (
  select 1 from public.creatures c
  where c.id = animal_records.creature_id and c.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.creatures c
  where c.id = animal_records.creature_id and c.owner_id = (select auth.uid())
));

-- An owner must never be able to forge a vet attestation on their own animal.
create or replace function public.enforce_vet_attestation_immutable()
returns trigger language plpgsql as $$
begin
  if new.vet_attested_by is distinct from old.vet_attested_by
     or new.vet_attested_at is distinct from old.vet_attested_at then
    raise exception 'vet_attestation_not_self_writable';
  end if;
  new.updated_at := now();
  return new;
end; $$;

create trigger animal_records_vet_guard
before update on public.animal_records
for each row execute function public.enforce_vet_attestation_immutable();

-- Inserts must not arrive pre-attested either.
create or replace function public.enforce_vet_attestation_absent_on_insert()
returns trigger language plpgsql as $$
begin
  if new.vet_attested_by is not null or new.vet_attested_at is not null then
    raise exception 'vet_attestation_not_self_writable';
  end if;
  return new;
end; $$;

create trigger animal_records_vet_guard_insert
before insert on public.animal_records
for each row execute function public.enforce_vet_attestation_absent_on_insert();
