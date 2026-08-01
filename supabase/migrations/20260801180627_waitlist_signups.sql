-- Waitlist: the pre-launch front door for outside traffic. First consumer is
-- the Husbandry YouTube channel's CTA; `source` records which door someone
-- came through so a campaign can be judged honestly later.
--
-- Deliberately NOT tied to auth. The person leaving an email is not a user
-- yet — asking them to create an account first is exactly the friction this
-- table exists to remove.
--
-- Write-only from the API's perspective: anon may INSERT, nobody may read,
-- change, or delete rows through the client. Reads happen in SQL by an
-- operator. A table you can never SELECT through the API cannot become an
-- email oracle (the admin_notes / points_balance lesson, applied on day one
-- instead of found by probing later).

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  species_interest text[] not null default '{}',
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  constraint waitlist_email_shape check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint waitlist_email_length check (char_length(email) <= 320),
  constraint waitlist_source_length check (char_length(source) between 1 and 40),
  constraint waitlist_species_bounded check (coalesce(array_length(species_interest, 1), 0) <= 8)
);

-- One row per address, case-insensitive. The action treats a collision as
-- success — signing up twice is not an error a visitor needs to hear about,
-- and a distinguishable "already exists" reply would leak who is on the list.
create unique index waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

-- Grants first (the table-grant lesson: column-level revokes do nothing;
-- revoke the table, grant back the allowlist), then the single policy.
revoke all on table public.waitlist_signups from anon, authenticated;
grant insert on table public.waitlist_signups to anon, authenticated;

create policy "waitlist is join-only"
  on public.waitlist_signups for insert
  to anon, authenticated
  with check (true);
