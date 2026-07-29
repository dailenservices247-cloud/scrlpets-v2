-- Phase A.4 — breeder records: genetic tests, breeding events, health
-- reminders (grill closing sweep; V1-05/V1-08/V1-10).
--
-- All three are honest self-recorded data. Genetic tests are SELF-REPORTED
-- and the UI labels them so (same honesty pattern as service verification
-- badges); no AI touches any of this. Legacy's defects fixed by design:
-- tests are deletable, reminder recurrence actually reschedules, breeding
-- event types match their constraint.

-- ============================================================ GENETIC TESTS
create table if not exists public.genetic_tests (
  id uuid default gen_random_uuid() not null,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete cascade,
  test_type text not null,
  condition_name text not null,
  result text not null,
  grade text,
  gene_name text,
  genotype text,
  provider text,
  test_date date,
  certificate_number text,
  notes text,
  created_at timestamptz default now() not null,
  constraint genetic_tests_pkey primary key (id),
  constraint genetic_tests_type_check check (test_type in (
    'hip','elbow','cardiac','eye','patella','thyroid','pennhip',
    'dna_panel','dna_single','other'
  )),
  constraint genetic_tests_result_check check (result in (
    'clear','carrier','affected','normal','abnormal','pending'
  ))
);
create index if not exists idx_genetic_tests_creature
  on public.genetic_tests using btree (creature_id, test_date desc);

alter table public.genetic_tests enable row level security;

-- Visibility follows the creature (public health transparency is the point);
-- writes are owner-of-the-creature only.
create policy "read tests of visible creatures" on public.genetic_tests
for select to anon, authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = genetic_tests.creature_id
      and (c.page_visible = true or c.owner_id = (select auth.uid()))
  )
);

create policy "owner writes tests" on public.genetic_tests
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1 from public.creatures c
    where c.id = genetic_tests.creature_id and c.owner_id = (select auth.uid())
  )
);

create policy "owner updates tests" on public.genetic_tests
for update to authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = genetic_tests.creature_id and c.owner_id = (select auth.uid())
  )
);

create policy "owner deletes tests" on public.genetic_tests
for delete to authenticated
using (
  exists (
    select 1 from public.creatures c
    where c.id = genetic_tests.creature_id and c.owner_id = (select auth.uid())
  )
);

-- ========================================================== BREEDING EVENTS
-- Species gestation data as a TABLE, not hardcoded client math (legacy's map
-- was fine data trapped in a component).
create table if not exists public.species_gestation (
  species text not null,
  gestation_days integer not null,
  constraint species_gestation_pkey primary key (species),
  constraint species_gestation_days_positive check (gestation_days > 0)
);

insert into public.species_gestation (species, gestation_days) values
  ('dog', 63), ('cat', 65), ('rabbit', 31), ('guinea pig', 68),
  ('hamster', 16), ('horse', 340), ('goat', 150), ('sheep', 152),
  ('pig', 114), ('bird', 21), ('reptile', 60)
on conflict (species) do nothing;

alter table public.species_gestation enable row level security;
create policy "public read gestation" on public.species_gestation
for select to anon, authenticated using (true);

create table if not exists public.breeding_events (
  id uuid default gen_random_uuid() not null,
  breeder_id uuid not null references public.profiles(id) on delete cascade,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  partner_creature_id uuid references public.creatures(id) on delete set null,
  event_type text not null,
  event_date date not null,
  expected_due_date date,
  notes text,
  created_at timestamptz default now() not null,
  constraint breeding_events_pkey primary key (id),
  -- Legacy shipped a UI offering 3 types its constraint refused; here the
  -- constraint IS the full vocabulary.
  constraint breeding_events_type_check check (event_type in (
    'heat_start','heat_end','mating','pregnancy_confirmed','birth',
    'vet_visit','show','training'
  ))
);
create index if not exists idx_breeding_events_breeder
  on public.breeding_events using btree (breeder_id, event_date desc);

alter table public.breeding_events enable row level security;

-- Private operator data — the calendar is a working tool, not a public feed.
create policy "own breeding events" on public.breeding_events
for select to authenticated using (breeder_id = (select auth.uid()));
create policy "own insert breeding events" on public.breeding_events
for insert to authenticated
with check (
  breeder_id = (select auth.uid())
  and exists (
    select 1 from public.creatures c
    where c.id = breeding_events.creature_id and c.owner_id = (select auth.uid())
  )
);
create policy "own update breeding events" on public.breeding_events
for update to authenticated using (breeder_id = (select auth.uid()));
create policy "own delete breeding events" on public.breeding_events
for delete to authenticated using (breeder_id = (select auth.uid()));

-- Due date computed at the DB from the gestation table on mating events.
create or replace function public.compute_breeding_due_date()
returns trigger language plpgsql as $fn$
declare
  days integer;
begin
  if new.event_type = 'mating' and new.expected_due_date is null then
    select g.gestation_days into days
      from public.species_gestation g
      join public.creatures c on lower(c.species) = g.species
     where c.id = new.creature_id;
    if days is not null then
      new.expected_due_date := new.event_date + days;
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists breeding_events_due_date on public.breeding_events;
create trigger breeding_events_due_date
before insert or update on public.breeding_events
for each row execute function public.compute_breeding_due_date();

revoke execute on function public.compute_breeding_due_date() from anon, authenticated, public;

-- ========================================================= HEALTH REMINDERS
create table if not exists public.health_reminders (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  creature_id uuid references public.creatures(id) on delete cascade,
  reminder_type text not null,
  title text not null,
  due_date date not null,
  repeat_interval text not null default 'none',
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  constraint health_reminders_pkey primary key (id),
  constraint health_reminders_type_check check (reminder_type in (
    'vaccination','vet_visit','medication','grooming','deworming','other'
  )),
  constraint health_reminders_repeat_check check (repeat_interval in (
    'none','weekly','monthly','yearly'
  )),
  constraint health_reminders_title_check check (length(btrim(title)) between 1 and 120)
);
create index if not exists idx_health_reminders_profile
  on public.health_reminders using btree (profile_id, due_date);

alter table public.health_reminders enable row level security;
create policy "own health reminders" on public.health_reminders
for select to authenticated using (profile_id = (select auth.uid()));
create policy "own insert health reminders" on public.health_reminders
for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "own update health reminders" on public.health_reminders
for update to authenticated using (profile_id = (select auth.uid()));
create policy "own delete health reminders" on public.health_reminders
for delete to authenticated using (profile_id = (select auth.uid()));

-- Recurrence that actually recurs (legacy stored the field and never
-- rescheduled anything): completing a repeating reminder spawns the next one.
create or replace function public.reschedule_completed_reminder()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.completed_at is not null and old.completed_at is null
     and new.repeat_interval <> 'none' then
    insert into public.health_reminders
      (profile_id, creature_id, reminder_type, title, due_date, repeat_interval, notes)
    values (
      new.profile_id, new.creature_id, new.reminder_type, new.title,
      case new.repeat_interval
        when 'weekly' then new.due_date + 7
        when 'monthly' then (new.due_date + interval '1 month')::date
        when 'yearly' then (new.due_date + interval '1 year')::date
      end,
      new.repeat_interval, new.notes
    );
  end if;
  return new;
end; $fn$;

drop trigger if exists health_reminders_reschedule on public.health_reminders;
create trigger health_reminders_reschedule
after update on public.health_reminders
for each row execute function public.reschedule_completed_reminder();

revoke execute on function public.reschedule_completed_reminder() from anon, authenticated, public;
