-- Phase A.1 — creature model expansion (extraction build queue, grill Q2/Q6/V1-04/V2-01).
--
-- Legacy's late-era design split creatures into pet vs breeding-animal roles
-- and made profile pages opt-in per animal ("insect/colony breeders leave
-- off"). Dailen adopted both (grill Q2), with visibility DEFAULT ON so the
-- marketplace stays alive — a colony breeder flips off or never creates
-- individual records. Memorial state is REVERSIBLE (legacy's wasn't, and its
-- destination page never rendered it — v2 renders it on the creature page).

alter table public.creatures
  add column if not exists creature_role text not null default 'pet',
  add column if not exists page_visible boolean not null default true,
  add column if not exists deceased_at date,
  add column if not exists memorial_message text,
  add column if not exists registration_number text,
  add column if not exists birth_date date,
  add column if not exists weaned_date date,
  add column if not exists breed text,
  add column if not exists gender text,
  add column if not exists color text,
  add column if not exists markings text,
  add column if not exists health_notes text;

do $$ begin
  alter table public.creatures add constraint creatures_role_check
    check (creature_role in ('pet','breeding'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.creatures add constraint creatures_gender_check
    check (gender is null or gender in ('male','female','unknown'));
exception when duplicate_object then null; end $$;

-- A memorial message without a deceased date is a contradiction; the date
-- without a message is fine (message optional).
do $$ begin
  alter table public.creatures add constraint creatures_memorial_needs_deceased
    check (memorial_message is null or deceased_at is not null);
exception when duplicate_object then null; end $$;

-- Visibility-aware public read. The old policy was unconditionally public;
-- owners must keep seeing their own hidden creatures, so this is a rewrite of
-- the permissive policy, not a RESTRICTIVE overlay (which would AND onto the
-- owner path and lock owners out of hidden rows).
drop policy if exists "public read creatures" on public.creatures;
create policy "public read visible creatures" on public.creatures
for select to anon, authenticated
using (page_visible = true or owner_id = (select auth.uid()));

-- Creatures had NO update policy at all — owner edit was still banked. The
-- role/visibility/memorial controls need one. Owner-only; identity columns
-- (owner_id, slug) are frozen by the trigger below rather than a column-level
-- policy Postgres can't express.
create policy "owner updates creatures" on public.creatures
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create or replace function public.enforce_creature_identity_immutable()
returns trigger language plpgsql as $fn$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'creature_owner_immutable';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'creature_slug_immutable';
  end if;
  return new;
end; $fn$;

drop trigger if exists creatures_identity_immutable on public.creatures;
create trigger creatures_identity_immutable
before update on public.creatures
for each row execute function public.enforce_creature_identity_immutable();

revoke execute on function public.enforce_creature_identity_immutable() from anon, authenticated, public;
