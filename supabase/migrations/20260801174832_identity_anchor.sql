-- The identity anchor: the keystone the whole transaction chain reads.
--
-- Code-at-handover proves a MEETING happened. It cannot prove WHICH ANIMAL
-- changed hands. The anchor is what closes that: one value, registered before
-- listing and read by every actor in the chain — breeder at registration, vet
-- on the health record, carrier at pickup, buyer or their vet at delivery.
-- Swapping animals then requires all four to collude.
--
-- SPECIES-NEUTRAL BY CONSTRUCTION. This app is for every animal kept as a pet,
-- and chips are not universal: birds carry leg bands, some reptiles a tag or
-- tattoo, and fish carry nothing at all. So the anchor is TYPED, and a species
-- with no physical marker is not pretended into one — it falls to the
-- provenance level instead. The listing shows which level applies rather than
-- implying every animal is equally verifiable.
--
-- THE VALUE IS NOT PUBLIC. A microchip number is the key to claiming an animal,
-- not a badge: published, it lets a stranger recite it to a vet or a registry
-- and assert ownership. The FACT of an anchor is public (that is the assurance
-- level); the VALUE is readable only by the animal's owner, and verifiable by
-- anyone holding a scanner via a function that answers yes/no and never returns
-- the number.
--
-- `registration_number` is deliberately left public — a kennel-club registration
-- is a lookup-able credential and is already rendered on listings. A chip number
-- is not the same kind of thing.

alter table public.creatures
  add column if not exists anchor_type text,
  add column if not exists anchor_value text;

alter table public.creatures
  drop constraint if exists creatures_anchor_type_check;
alter table public.creatures
  add constraint creatures_anchor_type_check
  check (anchor_type is null or anchor_type in ('microchip', 'leg_band', 'tattoo', 'tag'));

-- A type without a value (or the reverse) is a half-registered anchor, which
-- would read as "anchored" while proving nothing.
alter table public.creatures
  drop constraint if exists creatures_anchor_pair_check;
alter table public.creatures
  add constraint creatures_anchor_pair_check
  check (num_nulls(anchor_type, anchor_value) <> 1);

-- Globally unique when present: two animals sharing a chip number means the
-- anchor cannot identify either of them. Partial, so unanchored animals are
-- unaffected.
create unique index if not exists idx_creatures_anchor_value
  on public.creatures (anchor_value)
  where anchor_value is not null;

-- Column-level privileges are the only thing that filters columns; RLS filters
-- rows. So the table-wide grant goes and the readable columns come back
-- explicitly — anchor_value withheld. Note the shape: a column-level REVOKE
-- against a table-level grant is a SILENT NO-OP (it shipped that way twice in
-- this project), and this ordering is the one that works. It also means any
-- column added to creatures in future is invisible to clients until someone
-- grants it deliberately, which is the safer default for this table.
revoke select on public.creatures from anon, authenticated;

grant select (
  id, owner_id, name, species, slug, avatar_url, created_at,
  creature_role, page_visible, deceased_at, memorial_message,
  registration_number, birth_date, weaned_date, breed, gender,
  color, markings, health_notes, generation, is_founder, litter_id,
  archived_at, anchor_type
) on public.creatures to anon, authenticated;

-- Owners write their own anchor through the existing "owner updates creatures"
-- policy; UPDATE is not column-restricted here because that policy already
-- scopes the row, and the identity-immutable trigger guards owner_id and slug.
grant update (anchor_type, anchor_value) on public.creatures to authenticated;

/**
 * The animal's own keeper can read their anchor — they need it for the vet, the
 * registry, and their data export. Nobody else can, including a buyer mid-sale:
 * a buyer who could read it before handover could recite it instead of scanning
 * for it, which is precisely the check the anchor exists to make.
 */
create or replace function public.my_creature_anchor(target_creature uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.anchor_value
    from public.creatures c
   where c.id = target_creature
     and c.owner_id = (select auth.uid());
$$;

revoke execute on function public.my_creature_anchor(uuid) from anon, public;
grant execute on function public.my_creature_anchor(uuid) to authenticated;

/**
 * Yes/no, never the value. This is what the carrier and the buyer call at
 * handover with a scanned number. Returns false — not an error — for a wrong
 * value, a missing anchor, or an unknown creature, so a caller cannot
 * distinguish "no anchor registered" from "wrong number" and use the difference
 * to probe.
 *
 * ponytail: any authenticated caller may verify a guess. A 15-digit ISO chip
 * number is not brute-forceable at request rates, and narrowing this to
 * transaction parties would need the handover to exist before the animal can be
 * scanned — which is backwards. Revisit if verification ever becomes a
 * high-frequency endpoint.
 */
create or replace function public.verify_creature_anchor(
  target_creature uuid,
  scanned_value text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creatures c
     where c.id = target_creature
       and c.anchor_value is not null
       and c.anchor_value = btrim(scanned_value)
  );
$$;

revoke execute on function public.verify_creature_anchor(uuid, text) from anon, public;
grant execute on function public.verify_creature_anchor(uuid, text) to authenticated;

/**
 * The public assurance level — what a listing shows, and the honest answer to
 * "how sure can I be this is the animal in the photos?"
 *
 *   anchored   a unique physical identifier is registered
 *   documented no marker, but the animal has a registered litter and a birth
 *              date on the platform — provenance rather than proof
 *   declared   the owner's word, nothing behind it
 *
 * Deliberately DERIVED, never stored: a stored level drifts from the facts the
 * moment one of them changes, and this is a trust signal.
 */
create or replace function public.creature_assurance(target_creature uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.anchor_value is not null then 'anchored'
    when c.litter_id is not null and c.birth_date is not null then 'documented'
    else 'declared'
  end
    from public.creatures c
   where c.id = target_creature;
$$;
