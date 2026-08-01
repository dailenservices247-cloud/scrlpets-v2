-- Anchor matching only trimmed whitespace, which quietly broke the species the
-- anchor was made species-neutral FOR.
--
-- A microchip is 15 digits and survives a naive comparison. A leg band, tattoo
-- or tag does not: a band recorded as `ABC-123` and typed at handover as
-- `abc123` failed to match — and because verify_creature_anchor deliberately
-- cannot distinguish "wrong number" from "no anchor", the buyer got the same
-- flat no-match they would get for the wrong animal entirely. The one check
-- standing between a buyer and a swapped animal would have been failing on
-- punctuation.
--
-- Both sides are now normalised the same way: case folded, non-alphanumerics
-- dropped. `ABC-123`, `abc 123` and `ABC123` are one marker, which is what they
-- physically are.
--
-- Uniqueness has to normalise identically, or two animals could hold `ABC-123`
-- and `ABC123` — the same marker on paper, both "unique" to the database, and
-- the anchor stops identifying either of them. Verified before writing this:
-- zero collisions among the 8 anchors currently stored.
--
-- The stored value keeps its original formatting. The owner reads it back the
-- way it appears on the band, and only the comparison is normalised.

create or replace function public.normalise_anchor(raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(raw, ''), '[^a-zA-Z0-9]', '', 'g')), '');
$$;

drop index if exists idx_creatures_anchor_value;

create unique index if not exists idx_creatures_anchor_normalised
  on public.creatures (public.normalise_anchor(anchor_value))
  where anchor_value is not null;

/**
 * Unchanged in contract: yes/no, never the value, and a no-match still cannot
 * be told apart from "no anchor registered". Only the comparison changed.
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
       and public.normalise_anchor(c.anchor_value)
           is not distinct from public.normalise_anchor(scanned_value)
       and public.normalise_anchor(scanned_value) is not null
  );
$$;

revoke execute on function public.verify_creature_anchor(uuid, text) from anon, public;
grant execute on function public.verify_creature_anchor(uuid, text) to authenticated;
