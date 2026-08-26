-- V3-02 — the three consumer segments legacy carried and the v2 baseline dropped.
--
-- Legacy shipped nine categories; v2 shipped six. Walking and sitting are the
-- entire Rover/Wag market and photography is a real breeder-adjacent trade, so
-- their absence is a hole in the supply side rather than a simplification.
--
-- Legacy modelled this as a Postgres ENUM (`service_category`). v2's CHECK
-- constraint is the better mechanism and is kept: widening an enum is a
-- migration that takes a lock, widening a check is a drop and re-add. The
-- INTENT is ported; the implementation is not.
--
-- Widening only. Every value already stored still satisfies the new constraint,
-- so there is nothing to backfill and nothing to reject on the way in.

alter table public.services drop constraint if exists services_category_check;

alter table public.services add constraint services_category_check
  check (category is null or category = any (array[
    'grooming','training','boarding','transport','veterinary',
    'walking','sitting','photography','other'
  ]));
