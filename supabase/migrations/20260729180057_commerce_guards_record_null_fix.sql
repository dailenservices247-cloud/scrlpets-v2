-- Phase A.5 fix — `IF record IS NOT NULL` is only true when EVERY column of
-- the record is non-null, so any creature with a single null optional field
-- silently skipped the entire dog/cat age branch. Caught by the Phase A
-- acceptance spec (a 21-day-old dog listed successfully). Use FOUND.

create or replace function public.enforce_listing_commerce_guards()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  cap integer;
  c record;
  age_days integer;
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
      if c.birth_date is null or c.weaned_date is null then
        raise exception 'age_weaning_dates_required';
      end if;
      age_days := (current_date - c.birth_date);
      if age_days < 56 then
        raise exception 'under_eight_weeks';
      end if;
      if c.weaned_date > current_date then
        raise exception 'not_weaned';
      end if;
    end if;
  end if;

  return new;
end; $fn$;

revoke execute on function public.enforce_listing_commerce_guards() from anon, authenticated, public;
