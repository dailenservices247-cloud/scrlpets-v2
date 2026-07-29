-- Phase A.5 — commerce guards: adoption fee cap + 9 CFR 2.130 (grill Q4, V2-06).
--
-- Two DB-enforced honesty rules. The cap makes "adoption" a real category
-- (without it, adoption is a sale wearing a sympathy label). The federal
-- eight-week rule is species-CORRECT, not species-blind: 9 CFR 2.130 covers
-- dogs and cats; other species get no fake universal gate.

-- Cap amount lives in platform_flags so changing it is an operator action,
-- not a migration. 50000 cents = the $500 legacy intended (client-side only,
-- back then).
insert into public.platform_flags (key, enabled, value_int)
values ('adoption_fee_cap_cents', true, 50000)
on conflict (key) do nothing;

-- Structured adoption/screening fields ride Phase C UI; the listing date
-- surface (Born/Ready) reads creature birth/weaned from A.1.
create or replace function public.enforce_listing_commerce_guards()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  cap integer;
  c record;
  age_days integer;
begin
  -- Adoption fee ceiling (flag-disabled = no cap, honest kill switch).
  if new.listing_kind = 'adoption' then
    select value_int into cap from public.platform_flags
     where key = 'adoption_fee_cap_cents' and enabled = true;
    if cap is not null and new.price_cents > cap then
      raise exception 'adoption_fee_above_cap';
    end if;
  end if;

  -- 9 CFR 2.130: dogs/cats offered for sale or adoption must be at least 8
  -- weeks old AND weaned. Enforced when an animal is attached; a dog/cat
  -- animal listing without recorded birth+weaned dates cannot publish (the
  -- date is the compliance evidence).
  if new.creature_id is not null and new.listing_kind in ('sale','adoption') then
    select * into c from public.creatures where id = new.creature_id;
    if c is not null and lower(coalesce(c.species, '')) in ('dog','cat') then
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

drop trigger if exists listings_commerce_guards on public.listings;
create trigger listings_commerce_guards
before insert or update on public.listings
for each row execute function public.enforce_listing_commerce_guards();

revoke execute on function public.enforce_listing_commerce_guards() from anon, authenticated, public;

-- Structured adoption profile fields (V2-03a): live on the LISTING because
-- they describe this rehoming, not the animal forever. Species-neutral names.
alter table public.listings
  add column if not exists adoption_spayed_neutered boolean,
  add column if not exists adoption_vaccinated boolean,
  add column if not exists adoption_microchipped boolean,
  add column if not exists adoption_good_with_kids boolean,
  add column if not exists adoption_good_with_dogs boolean,
  add column if not exists adoption_good_with_cats boolean,
  add column if not exists adoption_reason text,
  add column if not exists adoption_special_needs text;

-- Screening application answers (V2-03b): fixed structured fields on
-- buyer_applications — a form, not a form builder.
alter table public.buyer_applications
  add column if not exists living_situation text,
  add column if not exists has_yard boolean,
  add column if not exists other_pets text,
  add column if not exists experience_level text;

do $$ begin
  alter table public.buyer_applications add constraint buyer_applications_living_check
    check (living_situation is null or living_situation in ('house','apartment','condo','farm','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.buyer_applications add constraint buyer_applications_experience_check
    check (experience_level is null or experience_level in ('first_time','some_experience','experienced'));
exception when duplicate_object then null; end $$;
