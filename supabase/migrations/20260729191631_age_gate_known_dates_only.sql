-- Phase B fix — the 9 CFR 2.130 gate refused any dog/cat listing whose animal
-- had no recorded birth/weaned dates. That over-reached: the federal rule
-- prohibits transferring an animal that IS under eight weeks or unweaned, not
-- listing one whose age is unrecorded. Demanding dates as proof-of-innocence
-- blocked every existing seller (caught by the full E2E suite: real listing
-- flows across marketplace, compose, follows and content specs all refused).
--
-- Correct shape: enforce on KNOWN dates. An unknown birth date is unknown, not
-- a violation. Recording dates is driven in the UI (Phase C surfaces
-- Born/Ready/Weaned on the listing form), and a seller who states a birth date
-- under eight weeks is refused — which is the actual regulated act.

create or replace function public.enforce_listing_commerce_guards()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  cap integer;
  c record;
begin
  if new.listing_kind = 'adoption' then
    select value_int into cap from public.platform_flags
     where key = 'adoption_fee_cap_cents' and enabled = true;
    if cap is not null and new.price_cents > cap then
      raise exception 'adoption_fee_above_cap';
    end if;
  end if;

  if new.creature_id is not null and new.listing_kind in ('sale','adoption') then
    select * into c from public.creatures where id = new.creature_id;
    if found and lower(coalesce(c.species, '')) in ('dog','cat') then
      -- Known and underage → refuse (the regulated act).
      if c.birth_date is not null and (current_date - c.birth_date) < 56 then
        raise exception 'under_eight_weeks';
      end if;
      -- Known and not yet weaned → refuse.
      if c.weaned_date is not null and c.weaned_date > current_date then
        raise exception 'not_weaned';
      end if;
    end if;
  end if;

  return new;
end; $fn$;

revoke execute on function public.enforce_listing_commerce_guards() from anon, authenticated, public;
