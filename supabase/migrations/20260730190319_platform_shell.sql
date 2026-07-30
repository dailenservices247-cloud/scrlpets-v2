-- Phase E spine. Small again: account_suspensions already carries actor_id and
-- reason, moderation_actions is already the audit trail an admin viewer needs,
-- redemptions already has status/reviewed_at/reviewed_by/admin_notes, and
-- referrals already has the code a QR encodes. None of those need schema.

-- 1. Person cover photos. Brands already have one; people did not.
alter table public.profiles
  add column if not exists cover_url text;

-- 2. Onboarding. species_interests is what the person said they care about, and
-- it stays EMPTY unless they choose — no default species, because guessing
-- "dog" is exactly the bias this app is not supposed to have. onboarded_at
-- records that the screen was answered or skipped, so it never shows twice.
alter table public.profiles
  add column if not exists species_interests text[] not null default '{}',
  add column if not exists onboarded_at timestamptz;

-- 3. Guides enrichment. Both nullable: an uncategorised general guide is valid.
alter table public.guides
  add column if not exists category text,
  add column if not exists species text;

create index if not exists idx_guides_category
  on public.guides (category) where category is not null;
create index if not exists idx_guides_species
  on public.guides (species) where species is not null;

-- 4. Guide bookmarks. Private to the person: nobody else can see what someone
-- is reading. No row cap, deliberately — a per-parent cap is what caused the
-- 42P17 recursion class fixed in 20260730095309/20260730101120.
create table if not exists public.guide_bookmarks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  guide_id uuid not null references public.guides(id) on delete cascade,
  created_at timestamptz default now() not null,
  constraint guide_bookmarks_pkey primary key (profile_id, guide_id)
);

alter table public.guide_bookmarks enable row level security;

create policy "own read bookmarks" on public.guide_bookmarks
for select to authenticated using (profile_id = (select auth.uid()));

create policy "own insert bookmarks" on public.guide_bookmarks
for insert to authenticated with check (profile_id = (select auth.uid()));

create policy "own delete bookmarks" on public.guide_bookmarks
for delete to authenticated using (profile_id = (select auth.uid()));

-- 5. Server-side login lockout: 5 failures in 15 minutes.
--
-- Client-side throttling is not a control — it is a suggestion, so the count
-- lives in the database and the decision is made by SECURITY DEFINER functions.
-- The table has RLS on and NO policies at all, which denies every client
-- directly; only the definer functions below can see it.
create table if not exists public.login_attempts (
  id uuid default gen_random_uuid() not null,
  email text not null,
  attempted_at timestamptz default now() not null,
  constraint login_attempts_pkey primary key (id)
);

create index if not exists idx_login_attempts_email
  on public.login_attempts (lower(email), attempted_at desc);

alter table public.login_attempts enable row level security;

/**
 * Records a FAILED attempt only — successes are not interesting and storing
 * them would be a login-history side-channel nobody asked for. Also trims
 * anything older than a day so the table cannot grow without bound.
 *
 * ponytail: the trim runs inline on every failure rather than on a schedule.
 * At this volume that is free; move it to a cron job if failures ever get
 * heavy enough for the delete to show up in latency.
 */
create or replace function public.record_login_failure(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (email) values (lower(trim(target_email)));
  delete from public.login_attempts where attempted_at < now() - interval '1 day';
end;
$$;

/**
 * True once there are 5+ failures for this address in the last 15 minutes.
 *
 * ponytail: callable by anon, because the check has to happen BEFORE anyone is
 * authenticated. That makes it a weak account-existence oracle — but only for
 * an address the caller has already failed against repeatedly, which they would
 * know anyway. Tighten by moving the call behind the service role if that
 * trade stops being acceptable.
 */
create or replace function public.is_locked_out(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 5
    from public.login_attempts
   where lower(email) = lower(trim(target_email))
     and attempted_at > now() - interval '15 minutes';
$$;

/** Clears the counter after a legitimate sign-in, so a good login un-sticks. */
create or replace function public.clear_login_failures(target_email text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where lower(email) = lower(trim(target_email));
$$;
