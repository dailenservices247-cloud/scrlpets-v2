-- Phase 2 — the trust core. Closes the two ledger P0s:
--   (1) listing publication was not capability-gated
--   (2) buyer/seller/program/animal verification states did not exist
--
-- Three SEPARATE evidence axes (legacy's fatal flaw was one mixed slot):
--   identity (person, vendor-held docs) | program (business credential,
--   reference-only) | animal (per-creature attestation).
-- Banned mechanics explicitly NOT reproduced: raw document storage, AI as
-- authority, fail-open approval, self-writable verification flags.

-- ---------------------------------------------------------------- platform role
create table if not exists public.platform_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  granted_at timestamptz default now() not null,
  constraint platform_roles_pkey primary key (profile_id, role),
  constraint platform_roles_role_check check (role = any (array['admin','moderator']))
);
alter table public.platform_roles enable row level security;
-- Read your own role only. NO insert/update/delete policy exists anywhere:
-- platform roles are seeded out-of-band, never self-granted (T4).
create policy "own read platform role" on public.platform_roles
for select to authenticated using (profile_id = (select auth.uid()));

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_roles
    where profile_id = auth.uid() and role = 'admin'
  );
$$;
revoke execute on function public.is_platform_admin() from anon, public;
grant execute on function public.is_platform_admin() to authenticated;

-- ------------------------------------------------------------------- audit log
create table if not exists public.verification_events (
  id uuid default gen_random_uuid() not null,
  subject_kind text not null,
  subject_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz default now() not null,
  constraint verification_events_pkey primary key (id),
  constraint verification_events_subject_kind_check
    check (subject_kind = any (array['identity','program','animal','buyer']))
);
alter table public.verification_events enable row level security;
-- Append-only: definer functions write; admins read. No update/delete ever (T6).
create policy "admins read verification events" on public.verification_events
for select to authenticated using (public.is_platform_admin());

-- -------------------------------------------------------------- identity (D1/D5)
-- Status and provider REFERENCE only. The provider holds every document; this
-- table must never gain a column containing identity material (T7).
create table if not exists public.identity_verifications (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'stripe_identity',
  provider_ref text,
  status text not null default 'pending',
  submitted_at timestamptz default now() not null,
  decided_at timestamptz,
  constraint identity_verifications_pkey primary key (profile_id),
  constraint identity_verifications_status_check
    check (status = any (array['pending','verified','failed','canceled']))
);
alter table public.identity_verifications enable row level security;
-- Read your own status. NO client write path at all — status arrives only
-- through record_identity_result, called by the signed webhook (T2).
create policy "own read identity verification" on public.identity_verifications
for select to authenticated using (profile_id = (select auth.uid()));

create or replace function public.start_identity_verification(session_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  insert into public.identity_verifications (profile_id, provider_ref, status, submitted_at)
  values (uid, session_ref, 'pending', now())
  on conflict (profile_id) do update
    set provider_ref = excluded.provider_ref,
        status = 'pending',
        submitted_at = now(),
        decided_at = null
  -- A verified person cannot be reset back to pending by re-running the flow.
  where public.identity_verifications.status <> 'verified';
  insert into public.verification_events (subject_kind, subject_id, actor_id, action)
  values ('identity', uid, uid, 'submitted');
end; $$;
revoke execute on function public.start_identity_verification(text) from anon, public;
grant execute on function public.start_identity_verification(text) to authenticated;

-- Called ONLY by the signature-verified webhook route (service context).
create or replace function public.record_identity_result(
  target_profile uuid, session_ref text, new_status text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_status not in ('verified','failed','canceled') then
    raise exception 'invalid_status';
  end if;
  update public.identity_verifications
     set status = new_status, decided_at = now(), provider_ref = coalesce(session_ref, provider_ref)
   where profile_id = target_profile;
  insert into public.verification_events (subject_kind, subject_id, action, detail)
  values ('identity', target_profile, new_status, session_ref);
end; $$;
revoke execute on function public.record_identity_result(uuid, text, text) from anon, authenticated, public;

create or replace function public.is_verified_seller(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.identity_verifications
    where profile_id = target_profile and status = 'verified'
  );
$$;
revoke execute on function public.is_verified_seller(uuid) from anon, public;
grant execute on function public.is_verified_seller(uuid) to authenticated;

-- ------------------------------------------------------------- buyer readiness
create table if not exists public.buyer_readiness (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attested_at timestamptz default now() not null,
  -- Reserved: phone verification needs a paid vendor nobody has approved yet.
  phone text,
  phone_verified_at timestamptz,
  constraint buyer_readiness_pkey primary key (profile_id)
);
alter table public.buyer_readiness enable row level security;
create policy "own read buyer readiness" on public.buyer_readiness
for select to authenticated using (profile_id = (select auth.uid()));
create policy "own insert buyer readiness" on public.buyer_readiness
for insert to authenticated with check (profile_id = (select auth.uid()));

-- ------------------------------------------------------- seller program (D2/A2)
-- REFERENCE-ONLY by design: credential number + issuing authority + public URL,
-- checked against public records. No document upload, so no sensitive-document
-- storage is reintroduced.
create table if not exists public.seller_programs (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  program_type text not null,
  credential_number text not null,
  issuing_authority text not null,
  public_url text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz default now() not null,
  constraint seller_programs_pkey primary key (id),
  constraint seller_programs_type_check check (
    program_type = any (array['kennel','business','rescue','usda','breed_club'])
  ),
  constraint seller_programs_status_check check (
    status = any (array['pending','approved','rejected'])
  )
);
create index if not exists idx_seller_programs_status
  on public.seller_programs using btree (status, created_at);

alter table public.seller_programs enable row level security;
create policy "own read seller programs" on public.seller_programs
for select to authenticated
using (profile_id = (select auth.uid()) or public.is_platform_admin());
create policy "own insert seller programs" on public.seller_programs
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and (brand_id is null or public.is_brand_manager(brand_id))
);
-- No client UPDATE policy: only an admin, through the definer below, decides.

create or replace function public.review_seller_program(
  target_program uuid, decision text, notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner_profile uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  update public.seller_programs
     set status = decision, reviewed_by = uid, reviewed_at = now(), review_notes = notes
   where id = target_program
  returning profile_id into owner_profile;
  if owner_profile is null then raise exception 'not_found'; end if;
  insert into public.verification_events (subject_kind, subject_id, actor_id, action, detail)
  values ('program', target_program, uid, decision, notes);
end; $$;
revoke execute on function public.review_seller_program(uuid, text, text) from anon, public;
grant execute on function public.review_seller_program(uuid, text, text) to authenticated;

-- --------------------------------------------------------- animal eligibility
-- A verified seller does NOT automatically make every animal listable — the
-- owner attests per animal (explicit ledger requirement).
create table if not exists public.animal_eligibility (
  creature_id uuid not null references public.creatures(id) on delete cascade,
  attested_by uuid not null references public.profiles(id) on delete cascade,
  attested_at timestamptz default now() not null,
  status text not null default 'attested',
  constraint animal_eligibility_pkey primary key (creature_id),
  constraint animal_eligibility_status_check
    check (status = any (array['attested','withdrawn']))
);
alter table public.animal_eligibility enable row level security;
create policy "public read animal eligibility" on public.animal_eligibility
for select to anon, authenticated using (true);

-- Writes go through the definer, which checks ownership (T8).
create or replace function public.attest_animal_eligibility(target_creature uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not exists (
    select 1 from public.creatures where id = target_creature and owner_id = uid
  ) then raise exception 'not_owner'; end if;
  insert into public.animal_eligibility (creature_id, attested_by, status)
  values (target_creature, uid, 'attested')
  on conflict (creature_id) do update
    set attested_by = uid, attested_at = now(), status = 'attested';
  insert into public.verification_events (subject_kind, subject_id, actor_id, action)
  values ('animal', target_creature, uid, 'attested');
end; $$;
revoke execute on function public.attest_animal_eligibility(uuid) from anon, public;
grant execute on function public.attest_animal_eligibility(uuid) to authenticated;

create or replace function public.is_animal_listable(target_creature uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.animal_eligibility
    where creature_id = target_creature and status = 'attested'
  );
$$;
revoke execute on function public.is_animal_listable(uuid) from anon, public;
grant execute on function public.is_animal_listable(uuid) to authenticated;

-- ----------------------------------------------------------------- THE GATE
-- P0: an ANIMAL listing (creature_id present) requires a verified seller AND
-- that specific animal attested. Product/service listings are untouched (D3).
drop policy if exists "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and (
    posting_as_type = 'person'
    or (
      posting_as_type = 'brand'
      and brand_id is not null
      and exists (
        select 1 from public.brand_memberships m
        where m.brand_id = listings.brand_id and m.profile_id = (select auth.uid())
      )
    )
  )
  and (
    creature_id is null
    or (
      public.is_verified_seller((select auth.uid()))
      and public.is_animal_listable(creature_id)
    )
  )
);
