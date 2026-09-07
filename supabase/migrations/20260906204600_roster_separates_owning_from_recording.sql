-- `owner_id` means two different things, and the profile believed the wrong one.
--
-- Recording a pedigree has nowhere to put an ancestor except `creatures`:
-- `creature_lineage` foreign-keys both sides to `creatures(id)`, and
-- `link_creature_parent` (20260729174901) raises `parent_not_yours` unless the
-- parent's `owner_id` is the caller. So a breeder recording a UKC certificate
-- inserts a row per ancestor under their own id, and `owner_id` comes to mean
-- BOTH "owns this animal" and "authored this record".
--
-- Every owner-scoped read then over-counts. A breeder with two dogs who
-- recorded one three-generation certificate published "Animals 8" — with six
-- of the eight owned by other named people, whom the certificate names. On a
-- marketplace whose premise is that a seller's profile can be trusted, that is
-- a misrepresentation, not a display bug.
--
-- Legacy had this distinction and the port lost it. `animals.is_owned_pet`
-- (20260110211213) became `creature_role ('pet','animal')` in legacy's own v2
-- migration, where 'animal' meant "a record, not my pet" and was the DEFAULT.
-- v2 kept the column name and redefined the values to ('pet','breeding') —
-- both of which assert ownership. The third state had nowhere left to go.
-- Legacy rendered its profile list unfiltered anyway, so only the schema half
-- is worth keeping; the render half is the bug being fixed here.
--
-- This is a separate column rather than a third `creature_role` value because
-- `updateCreatureDetails` writes `creature_role: role || 'pet'` on every edit.
-- A role-encoded ancestor would be silently promoted into the roster the first
-- time someone corrected its colour, re-inflating the count with no trace.
-- Keeping the axes apart means an unrelated edit cannot move an animal in or
-- out of the roster at all.
--
-- Named for the consequence, not the cause: an ancestor is the first reason a
-- row is out of the roster, and a sold or rehomed animal will be the next one.
alter table public.creatures
  add column if not exists in_roster boolean not null default true;

comment on column public.creatures.in_roster is
  'True when the owner_id actually OWNS this animal; false when they merely '
  'authored the record (a pedigree ancestor). Public rosters, counts, and '
  'anything sellable filter on this. Not a visibility dial — page_visible '
  'stays the visibility dial, and the two compose.';

-- Ancestors are the overwhelming majority of what will ever be false here, and
-- every owner-scoped read that matters is `owner_id + in_roster`.
create index if not exists idx_creatures_owner_roster
  on public.creatures using btree (owner_id, in_roster);
